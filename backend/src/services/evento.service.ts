import type {
  CatalogoVista,
  EventoCatalogoVista,
  EventoResumenVista,
  EventoVista,
  OrdenCatalogo,
  OrganizadorVista,
  ReseniasDelOrganizadorVista,
  SentidoCatalogo,
} from "@ai-ticket-it/shared";
import {
  Evento,
  ordenDeMisEventos,
  TipoEntrada,
  type DatosDeEvento,
  type DatosDeTipoEntrada,
} from "../domain/evento";
import { palabrasDeBusqueda } from "../domain/busqueda";
import { calcularPuntaje } from "../domain/resenia";
import { ordenarCatalogo, type Ordenable } from "../domain/orden-catalogo";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import { NoEncontradoError, SinPermisoError } from "../errors/index";
import type { CategoriaService } from "./categoria.service";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aEventoCatalogoVista, aEventoResumenVista, aEventoVista, aOrganizadorVista } from "./evento.vistas";
import type { ReseniaService } from "./resenia.service";
import { aReseniasDelOrganizadorVista, delLote } from "./resenia.vistas";
import type { UsuarioService } from "./usuario.service";
import type { VencimientoService } from "./vencimiento.service";

export interface DependenciasEventoService {
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  vencimientoService: VencimientoService;
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
  /** Sin valor: el inicial del criterio. */
  sentido?: SentidoCatalogo;
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
 * repositorios de eventos y compras, `VencimientoService`, los services de categorías, usuarios y
 * reseñas, el cerrojo compartido y el reloj, la única referencia de "ahora". Toda escritura sobre un
 * evento existente corre bajo `cerrojo.ejecutar(id, …)`: lee el reloj una vez adentro, relee el
 * evento y materializa los vencimientos de sus compras antes de verificar (constitución,
 * "Operaciones atómicas por evento"; 006, R3). Las lecturas muestran el cupo al día sin guardar.
 */
export class EventoService {
  readonly #eventos: RepositorioEventos;
  readonly #compras: RepositorioCompras;
  readonly #vencimientoService: VencimientoService;
  readonly #categoriaService: CategoriaService;
  readonly #usuarioService: UsuarioService;
  readonly #reseniaService: ReseniaService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({
    eventos,
    compras,
    vencimientoService,
    categoriaService,
    usuarioService,
    reseniaService,
    cerrojo,
    reloj,
  }: DependenciasEventoService) {
    this.#eventos = eventos;
    this.#compras = compras;
    this.#vencimientoService = vencimientoService;
    this.#categoriaService = categoriaService;
    this.#usuarioService = usuarioService;
    this.#reseniaService = reseniaService;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  /**
   * El catálogo de Explorar (UC-05): los eventos no realizados de todos los organizadores, filtrados
   * por texto y categoría. Lectura: sin cerrojo y con un único `ahora` por pedido. Hace un número fijo
   * de lecturas (sin N+1): la categoría pedida, los eventos y un lote por dueño (categorías,
   * organizadores y sus puntajes).
   */
  async listar(consulta: ConsultaCatalogoValidada): Promise<CatalogoVista> {
    const { texto, categoriaId, orden, sentido } = consulta;
    // Una referencia de la entrada (principio III): si no existe, 400 sobre query.categoriaId, antes
    // de leer los eventos. El error lo lanza el dueño de las categorías.
    if (categoriaId !== undefined) await this.#categoriaService.buscarReferenciada(categoriaId, "consulta");
    const ahora = this.#reloj.ahora();
    const todos = await this.#eventos.listar();
    const proximos = todos.filter((evento) => !evento.estaRealizado(ahora));
    // Antes de aplicar texto y categoría: decide el vacío de la app (R2).
    const hayEventosProximos = proximos.length > 0;
    const palabras = palabrasDeBusqueda(texto);
    const coincidentes = proximos.filter(
      (evento) =>
        (categoriaId === undefined || evento.categoriaId === categoriaId) && evento.coincideCon(palabras),
    );
    if (coincidentes.length === 0) return { eventos: [], hayEventosProximos };
    // El cupo (y "Agotado") al día: cuenta las entradas de las compras pendientes vencidas (R3).
    const filtrados = await this.#conCupoAlDia(coincidentes, ahora);

    const organizadorIds = new Set(filtrados.map((e) => e.organizadorId));
    const [categorias, organizadores, puntajes] = await Promise.all([
      this.#categoriaService.obtenerPorIds(filtrados.map((e) => e.categoriaId)),
      this.#usuarioService.obtenerPorIds([...organizadorIds]),
      // Todos sus eventos, próximos y realizados: solo se reseñan los realizados (R7).
      this.#reseniaService.puntajesPorOrganizador(todos.filter((e) => organizadorIds.has(e.organizadorId))),
    ]);
    // `obtenerPorIds` y `puntajesPorOrganizador` garantizan que están todos (si falta uno, lanzan).
    const elementos = filtrados.map((evento): ElementoDelCatalogo => {
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
      eventos: ordenarCatalogo(elementos, orden, sentido).map((elemento) => elemento.vista),
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

  /**
   * Público: lo usan editar, la vista de solo lectura y, en la 005, el detalle (R8). Sin cerrojo
   * (R2.4). El cupo se muestra al día (006, R3), sin guardar nada.
   */
  async obtener(id: string): Promise<EventoVista> {
    const ahora = this.#reloj.ahora();
    const guardado = await this.obtenerOFallar(id);
    const evento = (await this.#conCupoAlDia([guardado], ahora))[0] ?? guardado;
    const categoria = await this.#categoriaService.obtenerOFallar(evento.categoriaId);
    const organizador = await this.#organizadorVista(evento.organizadorId);
    return aEventoVista(evento, categoria, organizador, ahora);
  }

  /**
   * Reemplaza los datos del evento (no toca los tipos). Bajo el cerrojo del evento, relee y verifica
   * en el orden de R5: 404 → 403 → 400 categoría → 409 realizado → 409 fecha.
   */
  async actualizar(id: string, usuarioId: string, datos: DatosDeEvento): Promise<EventoVista> {
    return this.#cerrojo.ejecutar(id, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.obtenerDelOrganizador(id, usuarioId, ahora);
      const categoria = await this.#categoriaService.buscarReferenciada(datos.categoriaId);
      const actualizado = evento.actualizar(datos, ahora);
      await this.#eventos.guardar(actualizado);
      return aEventoVista(actualizado, categoria, await this.#organizadorVista(usuarioId), ahora);
    });
  }

  /** Elimina un evento propio, no realizado y sin compras (en ningún estado). Bajo el cerrojo del evento. */
  async eliminar(id: string, usuarioId: string): Promise<void> {
    await this.#cerrojo.ejecutar(id, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.obtenerDelOrganizador(id, usuarioId, ahora);
      const tieneCompras = await this.#compras.existePorEvento(id);
      evento.verificarQueSePuedeEliminar({ ahora, tieneCompras });
      await this.#eventos.eliminarPorId(id);
    });
  }

  /**
   * Búsqueda en lote para otro service (feature 007, `CompraService.misCompras`): un `Map` por id en
   * una sola lectura, sin tomar el cerrojo ni guardar nada. Los eventos se devuelven como están
   * guardados (sin cupo al día: quien los usa no muestra cupo). Si falta alguno, 404 como
   * `obtenerOFallar`.
   */
  async obtenerPorIds(ids: readonly string[]): Promise<Map<string, Evento>> {
    const eventos = new Map((await this.#eventos.listarPorIds(ids)).map((e) => [e.id, e]));
    if (ids.some((id) => !eventos.has(id))) {
      throw new NoEncontradoError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
    }
    return eventos;
  }

  /**
   * "Reseñas del organizador" (feature 012, R7): el organizador del evento con su puntaje y las
   * reseñas de **todos** sus eventos, de la más reciente a la más vieja. Lectura pública, sin cerrojo
   * ni reloj, con cuatro lecturas fijas: el evento (404), los eventos del organizador, sus reseñas y
   * los usuarios en lote (el organizador y los autores).
   */
  async reseniasDelOrganizador(eventoId: string): Promise<ReseniasDelOrganizadorVista> {
    const { organizadorId } = await this.obtenerOFallar(eventoId);
    const susEventos = await this.#eventos.listarPorOrganizador(organizadorId);
    const resenias = await this.#reseniaService.listarDeEventos(susEventos);
    const autores = resenias.map((resenia) => resenia.compradorId);
    const usuarios = await this.#usuarioService.obtenerPorIds([...new Set([organizadorId, ...autores])]);
    // El mismo cálculo y el mismo conjunto que `#organizadorVista` (FR-018), sin otra lectura.
    const puntaje = calcularPuntaje(resenias.map((resenia) => resenia.puntuacion));
    const organizador = aOrganizadorVista(delLote(usuarios, organizadorId, "el usuario"), puntaje);
    return aReseniasDelOrganizadorVista(
      organizador,
      resenias,
      usuarios,
      new Map(susEventos.map((evento) => [evento.id, evento])),
    );
  }

  /** Único lugar que busca un evento por id y lanza 404 si no existe. Lo usan los otros services. */
  async obtenerOFallar(id: string): Promise<Evento> {
    const evento = await this.#eventos.buscarPorId(id);
    if (!evento) throw new NoEncontradoError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
    return evento;
  }

  /**
   * El evento con los vencimientos de sus compras **materializados** (research R3): 404 → guarda las
   * compras vencidas como CANCELADA → si liberaron cupo, guarda el evento con el cupo devuelto (en
   * ese orden: una lectura intermedia nunca ve cupo de más, R8). Se llama **dentro** del cerrojo del
   * evento, con el `ahora` de la operación; no toma el cerrojo.
   */
  async obtenerAlDia(id: string, ahora: Date): Promise<Evento> {
    const evento = await this.obtenerOFallar(id);
    const liberado = await this.#vencimientoService.vencerPendientes(id, ahora);
    if (liberado.size === 0) return evento;
    const alDia = evento.devolverCupos(liberado);
    await this.#eventos.guardar(alDia);
    return alDia;
  }

  /**
   * El evento que el usuario actual quiere modificar, al día: 404 si no existe y 403 si no lo
   * organiza (principio VI); recién después materializa los vencimientos (un pedido sin permiso no
   * cambia nada). Las escrituras lo llaman dentro del cerrojo del evento, con su `ahora`.
   */
  async obtenerDelOrganizador(id: string, usuarioId: string, ahora: Date): Promise<Evento> {
    const evento = await this.obtenerOFallar(id);
    if (!evento.esOrganizadoPor(usuarioId)) {
      throw new SinPermisoError("Solo el organizador puede modificar este evento.");
    }
    return this.obtenerAlDia(id, ahora);
  }

  /**
   * Contraparte de lectura de `obtenerDelOrganizador` (feature 008, R6): 404 → 403 → el evento con el
   * cupo al día **sin guardar nada** y sin cerrojo. La usa "Compras del evento".
   */
  async leerDelOrganizador(id: string, usuarioId: string, ahora: Date): Promise<Evento> {
    const evento = await this.obtenerOFallar(id);
    if (!evento.esOrganizadoPor(usuarioId)) {
      throw new SinPermisoError("Solo el organizador del evento puede ver sus compras.");
    }
    return (await this.#conCupoAlDia([evento], ahora))[0] ?? evento;
  }

  /**
   * Los eventos como se ven en `ahora`: a cada uno le suma el cupo de sus compras pendientes vencidas,
   * **sin guardar nada** (lectura, sin cerrojo; R3). Una sola lectura de compras para todos (sin N+1).
   */
  async #conCupoAlDia(eventos: readonly Evento[], ahora: Date): Promise<Evento[]> {
    const liberado = await this.#vencimientoService.cupoLiberadoPorTipo(
      eventos.map((evento) => evento.id),
      ahora,
    );
    return eventos.map((evento) => {
      const porTipo = liberado.get(evento.id);
      return porTipo ? evento.devolverCupos(porTipo) : evento;
    });
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
