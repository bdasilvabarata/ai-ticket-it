import {
  EstadoCompra,
  type ChatDeLaCompraVista,
  type CompraDelEventoVista,
  type ComprasDelEventoVista,
  type CompraVista,
  type DatosCompra,
  type DatosMensaje,
  type EntradaDelEventoVista,
  type MensajeVista,
  type MiCompraVista,
  type MisComprasDelEventoVista,
  type ReseniaVista,
} from "@ai-ticket-it/shared";
import { esCodigoValido, normalizarCodigo } from "../domain/codigo-de-entrada";
import { Compra } from "../domain/compra";
import {
  compararComprasDelEvento,
  filtrarComprasDelEvento,
  resumenPorTipo,
  type FiltroDeComprasDelEvento,
} from "../domain/compras-del-evento";
import type { Evento } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import { compararMisCompras } from "../domain/orden-mis-compras";
import { paginar } from "../domain/paginacion";
import { exigirQuePuedeReseniar } from "../domain/resenia";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras } from "../domain/repositorios";
import type { Usuario } from "../domain/usuario";
import { entradasRestantes, exigirTopePorPersona } from "../domain/tope-por-persona";
import { exigirVentanaAbierta } from "../domain/ventana-de-uso";
import { CompraNoEncontradaError, EntradaNoEncontradaError, SinPermisoError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import {
  aCompraDelEventoVista,
  aCompraVista,
  aEntradaDelEventoVista,
  aMiCompraVista,
  aResumenTipoEntradaVista,
  aVentanaDeUsoVista,
} from "./compra.vistas";
import type { EventoService } from "./evento.service";
import { aChatDeLaCompraVista, aMensajeVista } from "./mensaje.vistas";
import type { ReseniaService } from "./resenia.service";
import { aReseniaVista } from "./resenia.vistas";
import type { TipoEntradaService } from "./tipo-entrada.service";
import type { UsuarioService } from "./usuario.service";

/** Solo quien hizo la compra puede verla, pagarla o cancelarla (403; el mensaje es el de la 006). */
function exigirQueEsSuya(compra: Compra, usuarioId: string): void {
  if (compra.compradorId !== usuarioId) {
    throw new SinPermisoError("Solo quien hizo la compra puede verla o pagarla.");
  }
}

/**
 * Solo el comprador y el organizador del evento leen y escriben en el chat de la compra (feature
 * 011, R2; 403).
 */
function exigirQueEsParte(compra: Compra, evento: Evento, usuarioId: string): void {
  if (compra.rolDe(usuarioId, evento.organizadorId) === null) {
    throw new SinPermisoError(
      "Solo el comprador y el organizador del evento pueden ver y escribir en el chat de esta compra.",
    );
  }
}

export interface DependenciasCompraService {
  compras: RepositorioCompras;
  eventoService: EventoService;
  tipoEntradaService: TipoEntradaService;
  usuarioService: UsuarioService;
  reseniaService: ReseniaService;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/**
 * Casos de uso de las compras (UC-06). Escribe solo el agregado `Compra`: el evento y su cupo se los
 * pide a sus dueños (`EventoService` lo lee al día y `TipoEntradaService` descuenta y guarda; R4).
 * El alta corre bajo el cerrojo **del evento** (el mismo que el de sus ediciones) con un único
 * `ahora`; las lecturas no lo usan y no guardan nada.
 */
export class CompraService {
  readonly #compras: RepositorioCompras;
  readonly #eventoService: EventoService;
  readonly #tipoEntradaService: TipoEntradaService;
  readonly #usuarioService: UsuarioService;
  readonly #reseniaService: ReseniaService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({
    compras,
    eventoService,
    tipoEntradaService,
    usuarioService,
    reseniaService,
    cerrojo,
    reloj,
  }: DependenciasCompraService) {
    this.#compras = compras;
    this.#eventoService = eventoService;
    this.#tipoEntradaService = tipoEntradaService;
    this.#usuarioService = usuarioService;
    this.#reseniaService = reseniaService;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  /** Único lugar que busca una compra por id y lanza 404 si no existe. */
  async obtenerOFallar(id: string): Promise<Compra> {
    const compra = await this.#compras.buscarPorId(id);
    if (!compra) throw new CompraNoEncontradaError();
    return compra;
  }

  /**
   * Único lugar que busca una compra por el código (canónico) de una de sus entradas (feature 010,
   * R3): si el formato no es válido, no hay compra con ese código o es de otro evento, 404
   * `ENTRADA_NO_ENCONTRADA` (sin revelar nada del otro evento).
   */
  async obtenerPorCodigoOFallar(eventoId: string, codigoCanonico: string): Promise<Compra> {
    const compra = esCodigoValido(codigoCanonico)
      ? await this.#compras.buscarPorCodigoDeEntrada(codigoCanonico)
      : null;
    if (!compra || compra.eventoId !== eventoId) throw new EntradaNoEncontradaError();
    return compra;
  }

  /**
   * Registra una compra PENDIENTE (data-model, "`CompraService.crear`"). Bajo el cerrojo del evento,
   * en el orden de R2: 404 evento (y materializa sus vencimientos) → 400 tipo → 409 realizado → 409
   * propio evento → 409 tope → 409 cupo. Guarda primero el evento con el cupo descontado y después la
   * compra (R8): una lectura intermedia nunca ve cupo de más.
   */
  async crear(
    eventoId: string,
    compradorId: string,
    { tipoEntradaId, cantidad }: DatosCompra,
  ): Promise<CompraVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerAlDia(eventoId, ahora);
      const tipo = this.#tipoEntradaService.buscarReferenciada(evento, tipoEntradaId);
      evento.exigirQueSePuedeComprar(compradorId, ahora);
      exigirTopePorPersona(tipo, cantidad, await this.#vigentes(eventoId, compradorId, ahora));
      const descontado = await this.#tipoEntradaService.descontarCupo(evento, tipoEntradaId, cantidad, ahora);
      const compra = Compra.registrar({
        id: this.#compras.siguienteId(),
        compradorId,
        eventoId,
        tipo,
        cantidad,
        codigos: this.#compras.siguientesCodigosDeEntrada(cantidad),
        ahora,
      });
      await this.#compras.guardar(compra);
      // Una compra nueva, pagada o cancelada nunca está UTILIZADA: sin reseña que mostrar (012, R6).
      return aCompraVista(compra, descontado, ahora, null);
    });
  }

  /**
   * La compra **al día** (una PENDIENTE vencida se ve CANCELADA por el sistema), solo para su
   * comprador: 404 → 403. Lectura: sin cerrojo y sin guardar nada.
   */
  async obtener(compraId: string, usuarioId: string): Promise<CompraVista> {
    const ahora = this.#reloj.ahora();
    const compra = await this.obtenerOFallar(compraId);
    exigirQueEsSuya(compra, usuarioId);
    const evento = await this.#eventoService.obtenerOFallar(compra.eventoId);
    const resenia = await this.#reseniaService.deCompradorEnEvento(compra.compradorId, compra.eventoId);
    return aCompraVista(compra.alDia(ahora), evento, ahora, resenia);
  }

  /**
   * Pago simulado (data-model, "`CompraService.pagar`"). La compra se lee una vez afuera solo para
   * saber qué cerrojo tomar (su `eventoId` no cambia). Bajo el cerrojo de **su evento**, con un
   * único `ahora`: materializa los vencimientos del evento (también el de esta, que devuelve su
   * cupo), relee la compra, 403 si no es suya, y `compra.pagar` decide entre 409 vencida, 409
   * transición inválida o CONFIRMADA. Que el evento haya empezado no importa (R9).
   */
  async pagar(compraId: string, usuarioId: string): Promise<CompraVista> {
    const { eventoId } = await this.obtenerOFallar(compraId);
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerAlDia(eventoId, ahora);
      const compra = await this.obtenerOFallar(compraId);
      exigirQueEsSuya(compra, usuarioId);
      const pagada = compra.pagar(usuarioId, ahora);
      await this.#compras.guardar(pagada);
      return aCompraVista(pagada, evento, ahora, null);
    });
  }

  /**
   * El comprador cancela una compra PENDIENTE sin esperar a que venza. Como `pagar`: bajo el
   * cerrojo de su evento, con un único `ahora`, materializa los vencimientos del evento, relee la
   * compra, 403 si no es suya y `compra.cancelar` decide entre 409 vencida, 409 transición inválida
   * o CANCELADA por el comprador. Guarda primero la compra y después el evento con su cupo devuelto
   * (como al vencer: nunca se ve cupo de más).
   */
  async cancelar(compraId: string, usuarioId: string): Promise<CompraVista> {
    const { eventoId } = await this.obtenerOFallar(compraId);
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerAlDia(eventoId, ahora);
      const compra = await this.obtenerOFallar(compraId);
      exigirQueEsSuya(compra, usuarioId);
      const cancelada = compra.cancelar(usuarioId, ahora, evento.fechaHora);
      await this.#compras.guardar(cancelada);
      const devuelto = await this.#tipoEntradaService.devolverCupo(
        evento,
        cancelada.tipoEntradaId,
        cancelada.cantidad,
      );
      return aCompraVista(cancelada, devuelto, ahora, null);
    });
  }

  /**
   * El organizador confirma que devolvió el dinero de una compra cancelada después de confirmada
   * (feature 009, R5): CANCELADA → REEMBOLSADA, sin plazo y sin tocar el cupo. La compra se lee una
   * vez afuera para saber qué cerrojo tomar. Bajo el cerrojo de su evento, con un único `ahora`:
   * 403 si no organiza el evento (también el comprador) y materializa sus vencimientos
   * (`obtenerDelOrganizador`), relee la compra y `compra.confirmarReembolso` decide el 409. Un solo
   * `guardar`, el de la compra.
   */
  async confirmarReembolso(compraId: string, usuarioId: string): Promise<CompraDelEventoVista> {
    const { eventoId } = await this.obtenerOFallar(compraId);
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      const compra = await this.obtenerOFallar(compraId);
      const reembolsada = compra.confirmarReembolso(usuarioId, ahora);
      await this.#compras.guardar(reembolsada);
      const comprador = await this.#usuarioService.obtenerOFallar(reembolsada.compradorId);
      return aCompraDelEventoVista(reembolsada, comprador, evento);
    });
  }

  /**
   * El organizador registra el uso de una entrada en "Registrar ingreso" (feature 008, R10; desde la
   * 010, acá: `CompraService` es el dueño de `Compra`, R3/R4). Bajo el cerrojo del evento, con un
   * único `ahora` leído adentro: 404 evento → 403 si no lo organiza (también el comprador) y
   * materializa sus vencimientos (`obtenerDelOrganizador`) → relee la compra por código (404) → 409
   * fuera de la ventana de uso → `compra.registrarUso` decide el 409 de transición inválida. Un solo
   * `guardar`, el de la compra: el cupo no cambia.
   */
  async registrarUso(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      const canonico = normalizarCodigo(codigo);
      const compra = await this.obtenerPorCodigoOFallar(eventoId, canonico);
      exigirVentanaAbierta(evento.fechaHora, ahora);
      const usada = compra.alDia(ahora).registrarUso(canonico, usuarioId, ahora);
      await this.#compras.guardar(usada);
      const comprador = await this.#usuarioService.obtenerOFallar(usada.compradorId);
      return aEntradaDelEventoVista(usada, canonico, comprador, evento, ahora);
    });
  }

  /**
   * Lo que el detalle del evento necesita saber del usuario actual: sus compras pendientes no
   * vencidas (de la más vieja a la más nueva), sus confirmadas y utilizadas (de la más nueva a la más vieja) y cuántas entradas más puede comprar de cada tipo
   * (0 en todos si organiza el evento). Lectura: sin cerrojo, con un `ahora` y sin guardar.
   */
  async misComprasDelEvento(eventoId: string, usuarioId: string): Promise<MisComprasDelEventoVista> {
    const ahora = this.#reloj.ahora();
    const evento = await this.#eventoService.obtenerOFallar(eventoId);
    const suyas = (await this.#compras.listarPorEventoYComprador(eventoId, usuarioId)).map((compra) =>
      compra.alDia(ahora),
    );
    const vigentes = suyas.filter((compra) => compra.esVigente(ahora));
    const organiza = evento.esOrganizadoPor(usuarioId);
    // Comprador y evento fijos: una sola lectura de reseñas para todas sus compras (feature 012, R6).
    const resenia = await this.#reseniaService.deCompradorEnEvento(usuarioId, eventoId);
    return {
      pendientes: suyas
        .filter((compra) => compra.estado === EstadoCompra.PENDIENTE)
        .toSorted((a, b) => a.creadaEn.getTime() - b.creadaEn.getTime())
        .map((compra) => aCompraVista(compra, evento, ahora, resenia)),
      // Las UTILIZADA también: "Ver mis entradas" muestra sus códigos (feature 008, R9).
      confirmadas: suyas
        .filter(
          (compra) => compra.estado === EstadoCompra.CONFIRMADA || compra.estado === EstadoCompra.UTILIZADA,
        )
        .toSorted((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime())
        .map((compra) => aCompraVista(compra, evento, ahora, resenia)),
      restantesPorTipo: evento.tiposEntrada.map((tipo) => ({
        tipoEntradaId: tipo.id,
        restantes: organiza ? 0 : entradasRestantes(tipo, vigentes),
      })),
    };
  }

  /**
   * "Mis compras" (feature 007): las del usuario como comprador, de todos los eventos y en todos
   * los estados, **al día** y en el orden de `compararMisCompras`. Lectura: un `ahora`, sin cerrojo
   * y sin guardar nada (no materializa vencimientos). Tres lecturas por pedido, cualquiera sea la
   * cantidad de compras: las compras, sus eventos en lote y las reseñas del usuario (feature 012; sin
   * compras, ninguna más).
   */
  async misCompras(usuarioId: string): Promise<MiCompraVista[]> {
    const ahora = this.#reloj.ahora();
    const compras = (await this.#compras.listarPorComprador(usuarioId)).map((compra) => compra.alDia(ahora));
    if (compras.length === 0) return [];
    const eventos = await this.#eventoService.obtenerPorIds([...new Set(compras.map((c) => c.eventoId))]);
    const resenias = await this.#reseniaService.deComprador(usuarioId);
    return compras
      .map((compra) => {
        // `obtenerPorIds` garantiza que están todos (si falta uno, lanza).
        const evento = eventos.get(compra.eventoId)!;
        return {
          id: compra.id,
          creadaEn: compra.creadaEn,
          fechaHoraEvento: evento.fechaHora,
          eventoRealizado: evento.estaRealizado(ahora),
          vista: aMiCompraVista(compra, evento, ahora, resenias.get(compra.eventoId) ?? null),
        };
      })
      .toSorted(compararMisCompras)
      .map(({ vista }) => vista);
  }

  /**
   * "Compras del evento" (feature 008, R6; paginada en la 013, R4): las compras del evento, de todos
   * los compradores, **al día**, solo para su organizador (404 → 403). La ventana, el resumen por
   * tipo, el contador de mensajes sin responder y `cantidadCompras` son de **todas**; la lista es la
   * página pedida de las que cumplen el filtro. Lectura: un `ahora`, sin cerrojo y sin guardar.
   * Lecturas fijas (FR-002): el evento, sus pendientes (cupo al día), sus compras y los compradores
   * de la página en lote (con la página vacía, ninguna de usuarios).
   */
  async comprasDelEvento(
    eventoId: string,
    usuarioId: string,
    { pagina, ...filtro }: FiltroDeComprasDelEvento & { pagina: number } = { pagina: 1, sinResponder: false },
  ): Promise<ComprasDelEventoVista> {
    const ahora = this.#reloj.ahora();
    const evento = await this.#eventoService.leerDelOrganizador(eventoId, usuarioId, ahora);
    const compras = (await this.#compras.listarPorEvento(eventoId))
      .map((compra) => compra.alDia(ahora))
      .toSorted(compararComprasDelEvento);
    const { elementos: deLaPagina, pagina: paginaVista } = paginar(
      filtrarComprasDelEvento(compras, filtro),
      pagina,
    );
    const compradores =
      deLaPagina.length === 0
        ? new Map<string, Usuario>()
        : await this.#usuarioService.obtenerPorIds([...new Set(deLaPagina.map((c) => c.compradorId))]);
    return {
      evento: {
        id: evento.id,
        nombre: evento.nombre,
        fechaHoraLocal: horaDeBuenosAires(evento.fechaHora),
        realizado: evento.estaRealizado(ahora),
      },
      ventanaDeUso: aVentanaDeUsoVista(evento.fechaHora, ahora),
      // El evento ya llega con el cupo al día y las compras, al día: sin guardar nada (R7).
      resumenPorTipo: resumenPorTipo(evento.tiposEntrada, compras).map(aResumenTipoEntradaVista),
      // `obtenerPorIds` garantiza que están todos (si falta uno, lanza).
      compras: deLaPagina.map((compra) =>
        aCompraDelEventoVista(compra, compradores.get(compra.compradorId)!, evento),
      ),
      comprasConMensajesSinResponder: compras.filter((compra) => compra.mensajeSinResponder).length,
      cantidadCompras: compras.length,
      pagina: paginaVista,
    };
  }

  /**
   * El chat de la compra (feature 011, R5), solo para sus dos partes: 404 → 403. Lectura: sin
   * cerrojo y sin guardar, con el estado **al día**; tres lecturas fijas (la compra, el evento y las
   * dos partes en lote), haya los mensajes que haya.
   */
  async chat(compraId: string, usuarioId: string): Promise<ChatDeLaCompraVista> {
    const ahora = this.#reloj.ahora();
    const compra = await this.obtenerOFallar(compraId);
    const evento = await this.#eventoService.obtenerOFallar(compra.eventoId);
    exigirQueEsParte(compra, evento, usuarioId);
    const partes = await this.#usuarioService.obtenerPorIds([compra.compradorId, evento.organizadorId]);
    return aChatDeLaCompraVista(compra.alDia(ahora), evento, partes, usuarioId);
  }

  /**
   * Un mensaje nuevo en el chat de la compra (feature 011, R4), de una de sus dos partes, en
   * cualquier estado y momento. La compra se lee una vez afuera solo para saber qué cerrojo tomar.
   * Bajo el cerrojo de su evento, con un único `ahora`: relee el evento y la compra, 403 si no es
   * parte, y recién después materializa los vencimientos del evento (también el de esta compra) y
   * relee la compra al día. Un solo `guardar`, el de la compra con el mensaje: el cupo no cambia.
   */
  async enviarMensaje(compraId: string, usuarioId: string, { texto }: DatosMensaje): Promise<MensajeVista> {
    const { eventoId } = await this.obtenerOFallar(compraId);
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const guardado = await this.#eventoService.obtenerOFallar(eventoId);
      exigirQueEsParte(await this.obtenerOFallar(compraId), guardado, usuarioId);
      const evento = await this.#eventoService.obtenerAlDia(eventoId, ahora);
      const conMensaje = (await this.obtenerOFallar(compraId)).enviarMensaje(usuarioId, texto, ahora);
      await this.#compras.guardar(conMensaje);
      const autor = await this.#usuarioService.obtenerOFallar(usuarioId);
      const mensaje = conMensaje.mensajes.at(-1)!;
      return aMensajeVista(mensaje, conMensaje.mensajes.length, conMensaje, evento, autor);
    });
  }

  /**
   * Reseñar un evento (feature 012, R2, R3): bajo el cerrojo del evento, con el reloj leído adentro:
   * 404 evento → 409 propio evento → 409 sin compra UTILIZADA → 409 repetida (la verifica y guarda
   * `ReseniaService.registrar`, sin tomar el cerrojo). No materializa vencimientos ni guarda compras
   * ni eventos: la compra y el cupo no cambian (FR-007).
   */
  async reseniar(
    eventoId: string,
    usuarioId: string,
    datos: { puntuacion: number; comentario: string },
  ): Promise<ReseniaVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerOFallar(eventoId);
      const compras = await this.#compras.listarPorEventoYComprador(eventoId, usuarioId);
      exigirQuePuedeReseniar({ usuarioId, evento, compras });
      const resenia = await this.#reseniaService.registrar(
        { eventoId, compradorId: usuarioId, puntuacion: datos.puntuacion, comentario: datos.comentario },
        ahora,
      );
      return aReseniaVista(resenia);
    });
  }

  /** Sus compras de ese evento que cuentan para el tope en `ahora` (PENDIENTE no vencidas, CONFIRMADA y UTILIZADA). */
  async #vigentes(eventoId: string, compradorId: string, ahora: Date): Promise<Compra[]> {
    return (await this.#compras.listarPorEventoYComprador(eventoId, compradorId)).filter((compra) =>
      compra.esVigente(ahora),
    );
  }
}
