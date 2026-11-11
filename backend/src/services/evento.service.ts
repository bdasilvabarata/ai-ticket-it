import type { EventoResumenVista, EventoVista } from "@ai-ticket-it/shared";
import {
  Evento,
  ordenDeMisEventos,
  TipoEntrada,
  type DatosDeEvento,
  type DatosDeTipoEntrada,
} from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import { NoEncontradoError, SinPermisoError } from "../errors/index";
import type { CategoriaService } from "./categoria.service";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aEventoResumenVista, aEventoVista } from "./evento.vistas";

export interface DependenciasEventoService {
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  categoriaService: CategoriaService;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/** Datos ya validados de `POST /eventos`. */
export type DatosNuevoEventoValidados = DatosDeEvento & { tiposEntrada: DatosDeTipoEntrada[] };

/**
 * Casos de uso de eventos (UC-04). Recibe sus dependencias por constructor (principio III): los
 * repositorios de eventos y compras, el service de categorías, el cerrojo compartido y el reloj, la
 * única referencia de "ahora". Toda escritura sobre un evento existente corre bajo
 * `cerrojo.ejecutar(id, …)`: relee el evento y lee el reloj adentro (constitución, "Operaciones
 * atómicas por evento").
 */
export class EventoService {
  readonly #eventos: RepositorioEventos;
  readonly #compras: RepositorioCompras;
  readonly #categoriaService: CategoriaService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ eventos, compras, categoriaService, cerrojo, reloj }: DependenciasEventoService) {
    this.#eventos = eventos;
    this.#compras = compras;
    this.#categoriaService = categoriaService;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  /** Los eventos que organiza el usuario actual, en el orden de Mis eventos. */
  async listarMios(usuarioId: string): Promise<EventoResumenVista[]> {
    const ahora = this.#reloj.ahora();
    const eventos = (await this.#eventos.listarPorOrganizador(usuarioId)).toSorted(ordenDeMisEventos(ahora));
    return Promise.all(
      eventos.map(async (evento) =>
        aEventoResumenVista(evento, await this.#categoriaService.obtenerOFallar(evento.categoriaId), ahora),
      ),
    );
  }

  /**
   * Crea un evento con sus tipos; el organizador es el usuario actual (FR-009). Sin cerrojo: el id
   * es nuevo y nadie más puede tocarlo todavía (research R1). Orden: categoría (400) → fecha futura
   * → nombres repetidos (409).
   */
  async crear(usuarioId: string, datos: DatosNuevoEventoValidados): Promise<EventoVista> {
    const categoria = await this.#categoriaService.buscarReferenciada(datos.categoriaId);
    const { tiposEntrada, ...datosDelEvento } = datos;
    const ahora = this.#reloj.ahora();
    const evento = Evento.crear(
      {
        ...datosDelEvento,
        id: this.#eventos.siguienteId(),
        organizadorId: usuarioId,
        tiposEntrada: tiposEntrada.map(
          (tipo) => new TipoEntrada({ ...tipo, id: this.#eventos.siguienteId() }),
        ),
      },
      ahora,
    );
    await this.#eventos.guardar(evento);
    return aEventoVista(evento, categoria, ahora);
  }

  /** Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (R8). Sin cerrojo (R2.4). */
  async obtener(id: string): Promise<EventoVista> {
    const evento = await this.obtenerOFallar(id);
    const categoria = await this.#categoriaService.obtenerOFallar(evento.categoriaId);
    return aEventoVista(evento, categoria, this.#reloj.ahora());
  }

  /**
   * Reemplaza los datos del evento (no toca los tipos). Bajo el cerrojo del evento, relee y verifica
   * en el orden de R5: 404 → 403 → 400 categoría → 409 realizado → 409 fecha.
   */
  async actualizar(id: string, usuarioId: string, datos: DatosDeEvento): Promise<EventoVista> {
    return this.#cerrojo.ejecutar(id, async () => {
      const evento = await this.obtenerDelOrganizador(id, usuarioId);
      const categoria = await this.#categoriaService.buscarReferenciada(datos.categoriaId);
      const ahora = this.#reloj.ahora();
      const actualizado = evento.actualizar(datos, ahora);
      await this.#eventos.guardar(actualizado);
      return aEventoVista(actualizado, categoria, ahora);
    });
  }

  /** Elimina un evento propio, no realizado y sin compras (en ningún estado). Bajo el cerrojo del evento. */
  async eliminar(id: string, usuarioId: string): Promise<void> {
    await this.#cerrojo.ejecutar(id, async () => {
      const evento = await this.obtenerDelOrganizador(id, usuarioId);
      const tieneCompras = await this.#compras.existePorEvento(id);
      evento.verificarQueSePuedeEliminar({ ahora: this.#reloj.ahora(), tieneCompras });
      await this.#eventos.eliminarPorId(id);
    });
  }

  /** Único lugar que busca un evento por id y lanza 404 si no existe. Lo usan los otros services. */
  async obtenerOFallar(id: string): Promise<Evento> {
    const evento = await this.#eventos.buscarPorId(id);
    if (!evento) throw new NoEncontradoError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
    return evento;
  }

  /**
   * El evento que el usuario actual quiere modificar: 404 si no existe y 403 si no lo organiza
   * (principio VI). Las escrituras lo llaman dentro del cerrojo del evento.
   */
  async obtenerDelOrganizador(id: string, usuarioId: string): Promise<Evento> {
    const evento = await this.obtenerOFallar(id);
    if (!evento.esOrganizadoPor(usuarioId)) {
      throw new SinPermisoError("Solo el organizador puede modificar este evento.");
    }
    return evento;
  }
}
