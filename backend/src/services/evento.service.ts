import type {
  CatalogoVista,
  EventoCatalogoVista,
  EventoResumenVista,
  EventoVista,
  OrdenCatalogo,
  OrganizadorVista,
} from "@ai-ticket-it/shared";
import {
  Evento,
  ordenDeMisEventos,
  TipoEntrada,
  type DatosDeEvento,
  type DatosDeTipoEntrada,
} from "../domain/evento";
import { ordenarCatalogo, type Ordenable } from "../domain/orden-catalogo";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import { NoEncontradoError, SinPermisoError } from "../errors/index";
import type { CategoriaService } from "./categoria.service";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aEventoCatalogoVista, aEventoResumenVista, aEventoVista, aOrganizadorVista } from "./evento.vistas";
import type { ReseniaService } from "./resenia.service";
import type { UsuarioService } from "./usuario.service";

export interface DependenciasEventoService {
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  categoriaService: CategoriaService;
  usuarioService: UsuarioService;
  reseniaService: ReseniaService;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/** Consulta ya validada de `GET /eventos` (texto recortado, `""` = sin filtro). */
export interface ConsultaCatalogoValidada {
  texto: string;
  categoriaId?: string;
  orden: OrdenCatalogo;
}

/**
 * Lo que se ordena del catálogo: los datos de la entidad (`fechaHora` como `Date`, el puntaje sin
 * redondear) y su vista, que sale tal cual. Las vistas no se ordenan: no cumplen `Ordenable`.
 */
type ElementoDelCatalogo = Ordenable & { vista: EventoCatalogoVista };

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
  readonly #usuarioService: UsuarioService;
  readonly #reseniaService: ReseniaService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({
    eventos,
    compras,
    categoriaService,
    usuarioService,
    reseniaService,
    cerrojo,
    reloj,
  }: DependenciasEventoService) {
    this.#eventos = eventos;
    this.#compras = compras;
    this.#categoriaService = categoriaService;
    this.#usuarioService = usuarioService;
    this.#reseniaService = reseniaService;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  /**
   * El catálogo de Explorar (UC-05): los eventos no realizados de todos los organizadores. Lectura:
   * sin cerrojo y con un único `ahora` por pedido. Hace un número fijo de lecturas (sin N+1): los
   * eventos y un lote por dueño (categorías, organizadores y sus puntajes).
   */
  async listar(consulta: ConsultaCatalogoValidada): Promise<CatalogoVista> {
    const ahora = this.#reloj.ahora();
    const todos = await this.#eventos.listar();
    const proximos = todos.filter((evento) => !evento.estaRealizado(ahora));
    const hayEventosProximos = proximos.length > 0;
    if (proximos.length === 0) return { eventos: [], hayEventosProximos };

    const organizadorIds = new Set(proximos.map((e) => e.organizadorId));
    const [categorias, organizadores, puntajes] = await Promise.all([
      this.#categoriaService.obtenerPorIds(proximos.map((e) => e.categoriaId)),
      this.#usuarioService.obtenerPorIds([...organizadorIds]),
      // Todos sus eventos, próximos y realizados: solo se reseñan los realizados (R7).
      this.#reseniaService.puntajesPorOrganizador(todos.filter((e) => organizadorIds.has(e.organizadorId))),
    ]);
    // `obtenerPorIds` y `puntajesPorOrganizador` garantizan que están todos (si falta uno, lanzan).
    const elementos = proximos.map((evento): ElementoDelCatalogo => {
      const puntaje = puntajes.get(evento.organizadorId)!;
      const organizador = aOrganizadorVista(organizadores.get(evento.organizadorId)!, puntaje);
      return {
        id: evento.id,
        nombre: evento.nombre,
        fechaHora: evento.fechaHora,
        precioDesde: evento.precioDesde(),
        puntaje: puntaje.promedio,
        vista: aEventoCatalogoVista(evento, categorias.get(evento.categoriaId)!, organizador, ahora),
      };
    });
    return {
      eventos: ordenarCatalogo(elementos, "fecha").map((elemento) => elemento.vista),
      hayEventosProximos,
    };
  }

  /** Los eventos que organiza el usuario actual, en el orden de Mis eventos. */
  async listarMios(usuarioId: string): Promise<EventoResumenVista[]> {
    const ahora = this.#reloj.ahora();
    const eventos = (await this.#eventos.listarPorOrganizador(usuarioId)).toSorted(ordenDeMisEventos(ahora));
    const categorias = await this.#categoriaService.obtenerPorIds(eventos.map((e) => e.categoriaId));
    // `obtenerPorIds` garantiza que están todas (si falta una, ya lanzó).
    return eventos.map((evento) => aEventoResumenVista(evento, categorias.get(evento.categoriaId)!, ahora));
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
    return aEventoVista(evento, categoria, await this.#organizadorVista(usuarioId), ahora);
  }

  /** Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (R8). Sin cerrojo (R2.4). */
  async obtener(id: string): Promise<EventoVista> {
    const evento = await this.obtenerOFallar(id);
    const categoria = await this.#categoriaService.obtenerOFallar(evento.categoriaId);
    const organizador = await this.#organizadorVista(evento.organizadorId);
    return aEventoVista(evento, categoria, organizador, this.#reloj.ahora());
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
      return aEventoVista(actualizado, categoria, await this.#organizadorVista(usuarioId), ahora);
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

  /**
   * El organizador con el puntaje de **todos** sus eventos (próximos y realizados; R7). El usuario
   * se lo pide a su dueño: si no existiera, el 404 es el de `UsuarioService`.
   */
  async #organizadorVista(organizadorId: string): Promise<OrganizadorVista> {
    const usuario = await this.#usuarioService.obtenerOFallar(organizadorId);
    const susEventos = await this.#eventos.listarPorOrganizador(organizadorId);
    return aOrganizadorVista(usuario, await this.#reseniaService.puntajeDe(susEventos));
  }
}
