import { randomUUID } from "node:crypto";
import type { EventoResumenVista, EventoVista } from "@ai-ticket-it/shared";
import type { Categoria } from "../domain/categoria";
import { Evento, TipoEntrada, type DatosDeEvento, type DatosDeTipoEntrada } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCategorias, RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import type { Cerrojo } from "./cerrojo-por-clave";
import { EntradaInvalidaError, NoEncontradoError } from "../errors/index";
import { aEventoResumenVista, aEventoVista } from "./evento.vistas";
import { exigirOrganizador } from "./organizador";

export interface DependenciasEventoService {
  eventos: RepositorioEventos;
  categorias: RepositorioCategorias;
  compras: RepositorioCompras;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/** Datos ya validados de `POST /eventos`. */
export type DatosNuevoEventoValidados = DatosDeEvento & { tiposEntrada: DatosDeTipoEntrada[] };

/** Próximos por fecha ascendente; después los realizados, del más reciente al más antiguo (FR-004). */
function compararParaMisEventos(a: EventoResumenVista, b: EventoResumenVista): number {
  if (a.realizado !== b.realizado) return a.realizado ? 1 : -1;
  const diferencia = Date.parse(a.fechaHora) - Date.parse(b.fechaHora);
  return a.realizado ? -diferencia : diferencia;
}

/**
 * Casos de uso de eventos (UC-04). Recibe sus dependencias por constructor (principio III): las
 * interfaces de repositorio, el cerrojo compartido y el reloj, la única referencia de "ahora".
 * Toda escritura sobre un evento existente corre bajo `cerrojo.ejecutar(id, …)`: relee el evento
 * y lee el reloj adentro (constitución, "Operaciones atómicas por evento").
 */
export class EventoService {
  readonly #eventos: RepositorioEventos;
  readonly #categorias: RepositorioCategorias;
  readonly #compras: RepositorioCompras;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ eventos, categorias, compras, cerrojo, reloj }: DependenciasEventoService) {
    this.#eventos = eventos;
    this.#categorias = categorias;
    this.#compras = compras;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  /** Los eventos que organiza el usuario actual, en el orden de Mis eventos. */
  async listarMios(usuarioId: string): Promise<EventoResumenVista[]> {
    const eventos = await this.#eventos.listarPorOrganizador(usuarioId);
    const categorias = new Map(
      (await this.#categorias.listar()).map((categoria) => [categoria.id, categoria]),
    );
    const ahora = this.#reloj.ahora();
    return eventos
      .map((evento) => aEventoResumenVista(evento, categoriaDe(evento, categorias), ahora))
      .toSorted(compararParaMisEventos);
  }

  /**
   * Crea un evento con sus tipos; el organizador es el usuario actual (FR-009). Sin cerrojo: el id
   * es nuevo y nadie más puede tocarlo todavía (research R1). Orden: categoría (400) → fecha futura
   * → nombres repetidos (409).
   */
  async crear(usuarioId: string, datos: DatosNuevoEventoValidados): Promise<EventoVista> {
    const categoria = await this.#categoriaOFallar(datos.categoriaId);
    const { tiposEntrada, ...datosDelEvento } = datos;
    const ahora = this.#reloj.ahora();
    const evento = Evento.crear(
      {
        ...datosDelEvento,
        id: randomUUID(),
        organizadorId: usuarioId,
        tiposEntrada: tiposEntrada.map((tipo) => new TipoEntrada({ ...tipo, id: randomUUID() })),
      },
      ahora,
    );
    await this.#eventos.guardar(evento);
    return aEventoVista(evento, categoria, ahora);
  }

  /** Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (R8). Sin cerrojo (R2.4). */
  async obtener(id: string): Promise<EventoVista> {
    const evento = await this.#obtenerOFallar(id);
    return aEventoVista(evento, await this.#categoriaDe(evento), this.#reloj.ahora());
  }

  /**
   * Reemplaza los datos del evento (no toca los tipos). Bajo el cerrojo del evento, relee y verifica
   * en el orden de R5: 404 → 403 → 400 categoría → 409 realizado → 409 fecha.
   */
  async actualizar(id: string, usuarioId: string, datos: DatosDeEvento): Promise<EventoVista> {
    return this.#cerrojo.ejecutar(id, async () => {
      const evento = await this.#obtenerOFallar(id);
      exigirOrganizador(evento, usuarioId);
      const categoria = await this.#categoriaOFallar(datos.categoriaId);
      const ahora = this.#reloj.ahora();
      const actualizado = evento.actualizar(datos, ahora);
      await this.#eventos.guardar(actualizado);
      return aEventoVista(actualizado, categoria, ahora);
    });
  }

  /** Elimina un evento propio, no realizado y sin compras (en ningún estado). Bajo el cerrojo del evento. */
  async eliminar(id: string, usuarioId: string): Promise<void> {
    await this.#cerrojo.ejecutar(id, async () => {
      const evento = await this.#obtenerOFallar(id);
      exigirOrganizador(evento, usuarioId);
      const tieneCompras = await this.#compras.existePorEvento(id);
      evento.verificarQueSePuedeEliminar({ ahora: this.#reloj.ahora(), tieneCompras });
      await this.#eventos.eliminarPorId(id);
    });
  }

  /** Único lugar del service que busca un evento por id y lanza 404 si no existe. */
  async #obtenerOFallar(id: string): Promise<Evento> {
    const evento = await this.#eventos.buscarPorId(id);
    if (!evento) throw new NoEncontradoError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
    return evento;
  }

  async #categoriaDe(evento: Evento): Promise<Categoria> {
    const categoria = await this.#categorias.buscarPorId(evento.categoriaId);
    return categoriaDe(evento, new Map(categoria ? [[categoria.id, categoria]] : []));
  }

  /** La categoría elegida tiene que existir: si no, 400 con detalle en `body.categoriaId` (R5). */
  async #categoriaOFallar(categoriaId: string): Promise<Categoria> {
    const categoria = await this.#categorias.buscarPorId(categoriaId);
    if (!categoria) {
      throw new EntradaInvalidaError([{ campo: "body.categoriaId", mensaje: "No existe la categoría." }]);
    }
    return categoria;
  }
}

/** La categoría de un evento guardado siempre existe (se verifica al crear y al editar). */
function categoriaDe(evento: Evento, categorias: Map<string, Categoria>): Categoria {
  const categoria = categorias.get(evento.categoriaId);
  if (!categoria) throw new Error(`El evento ${evento.id} tiene una categoría inexistente.`);
  return categoria;
}
