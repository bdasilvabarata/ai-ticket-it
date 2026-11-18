import {
  EstadoCompra,
  type ComprasDelEventoVista,
  type CompraVista,
  type DatosCompra,
  type MiCompraVista,
  type MisComprasDelEventoVista,
} from "@ai-ticket-it/shared";
import { Compra } from "../domain/compra";
import { compararComprasDelEvento } from "../domain/compras-del-evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import { compararMisCompras } from "../domain/orden-mis-compras";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras } from "../domain/repositorios";
import type { Usuario } from "../domain/usuario";
import { entradasRestantes, exigirTopePorPersona } from "../domain/tope-por-persona";
import { CompraNoEncontradaError, SinPermisoError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aCompraDelEventoVista, aCompraVista, aMiCompraVista, aVentanaDeUsoVista } from "./compra.vistas";
import type { EventoService } from "./evento.service";
import type { TipoEntradaService } from "./tipo-entrada.service";
import type { UsuarioService } from "./usuario.service";

/** Solo quien hizo la compra puede verla, pagarla o cancelarla (403; el mensaje es el de la 006). */
function exigirQueEsSuya(compra: Compra, usuarioId: string): void {
  if (compra.compradorId !== usuarioId) {
    throw new SinPermisoError("Solo quien hizo la compra puede verla o pagarla.");
  }
}

export interface DependenciasCompraService {
  compras: RepositorioCompras;
  eventoService: EventoService;
  tipoEntradaService: TipoEntradaService;
  usuarioService: UsuarioService;
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
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({
    compras,
    eventoService,
    tipoEntradaService,
    usuarioService,
    cerrojo,
    reloj,
  }: DependenciasCompraService) {
    this.#compras = compras;
    this.#eventoService = eventoService;
    this.#tipoEntradaService = tipoEntradaService;
    this.#usuarioService = usuarioService;
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
      return aCompraVista(compra, descontado, ahora);
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
    return aCompraVista(compra.alDia(ahora), evento, ahora);
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
      return aCompraVista(pagada, evento, ahora);
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
      const cancelada = compra.cancelar(usuarioId, ahora);
      await this.#compras.guardar(cancelada);
      const devuelto = await this.#tipoEntradaService.devolverCupo(
        evento,
        cancelada.tipoEntradaId,
        cancelada.cantidad,
      );
      return aCompraVista(cancelada, devuelto, ahora);
    });
  }

  /**
   * Lo que el detalle del evento necesita saber del usuario actual: sus compras pendientes no
   * vencidas (de la más vieja a la más nueva), sus confirmadas (de la más nueva a la más vieja) y cuántas entradas más puede comprar de cada tipo
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
    return {
      pendientes: suyas
        .filter((compra) => compra.estado === EstadoCompra.PENDIENTE)
        .toSorted((a, b) => a.creadaEn.getTime() - b.creadaEn.getTime())
        .map((compra) => aCompraVista(compra, evento, ahora)),
      confirmadas: suyas
        .filter((compra) => compra.estado === EstadoCompra.CONFIRMADA)
        .toSorted((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime())
        .map((compra) => aCompraVista(compra, evento, ahora)),
      restantesPorTipo: evento.tiposEntrada.map((tipo) => ({
        tipoEntradaId: tipo.id,
        restantes: organiza ? 0 : entradasRestantes(tipo, vigentes),
      })),
    };
  }

  /**
   * "Mis compras" (feature 007): las del usuario como comprador, de todos los eventos y en todos
   * los estados, **al día** y en el orden de `compararMisCompras`. Lectura: un `ahora`, sin cerrojo
   * y sin guardar nada (no materializa vencimientos). Dos lecturas por pedido, cualquiera sea la
   * cantidad de compras: las compras y sus eventos en lote (sin compras, ninguna de eventos).
   */
  async misCompras(usuarioId: string): Promise<MiCompraVista[]> {
    const ahora = this.#reloj.ahora();
    const compras = (await this.#compras.listarPorComprador(usuarioId)).map((compra) => compra.alDia(ahora));
    if (compras.length === 0) return [];
    const eventos = await this.#eventoService.obtenerPorIds([...new Set(compras.map((c) => c.eventoId))]);
    return compras
      .map((compra) => {
        // `obtenerPorIds` garantiza que están todos (si falta uno, lanza).
        const evento = eventos.get(compra.eventoId)!;
        return {
          id: compra.id,
          creadaEn: compra.creadaEn,
          fechaHoraEvento: evento.fechaHora,
          eventoRealizado: evento.estaRealizado(ahora),
          vista: aMiCompraVista(compra, evento, ahora),
        };
      })
      .toSorted(compararMisCompras)
      .map(({ vista }) => vista);
  }

  /**
   * "Compras del evento" (feature 008, R6): todas las compras del evento, de todos los compradores y
   * en todos los estados, **al día**, solo para su organizador (404 → 403). Lectura: un `ahora`, sin
   * cerrojo y sin guardar. Lecturas fijas (FR-002): el evento, sus pendientes (cupo al día), sus
   * compras y los compradores en lote (sin compras, ninguna de usuarios).
   */
  async comprasDelEvento(eventoId: string, usuarioId: string): Promise<ComprasDelEventoVista> {
    const ahora = this.#reloj.ahora();
    const evento = await this.#eventoService.leerDelOrganizador(eventoId, usuarioId, ahora);
    const compras = (await this.#compras.listarPorEvento(eventoId))
      .map((compra) => compra.alDia(ahora))
      .toSorted(compararComprasDelEvento);
    const compradores =
      compras.length === 0
        ? new Map<string, Usuario>()
        : await this.#usuarioService.obtenerPorIds([...new Set(compras.map((c) => c.compradorId))]);
    return {
      evento: {
        id: evento.id,
        nombre: evento.nombre,
        fechaHoraLocal: horaDeBuenosAires(evento.fechaHora),
        realizado: evento.estaRealizado(ahora),
      },
      ventanaDeUso: aVentanaDeUsoVista(evento.fechaHora, ahora),
      resumenPorTipo: [],
      // `obtenerPorIds` garantiza que están todos (si falta uno, lanza).
      compras: compras.map((compra) =>
        aCompraDelEventoVista(
          compra,
          compradores.get(compra.compradorId)!,
          evento.buscarTipoEntrada(compra.tipoEntradaId),
        ),
      ),
    };
  }

  /** Sus compras de ese evento que cuentan para el tope en `ahora` (PENDIENTE no vencidas y CONFIRMADA). */
  async #vigentes(eventoId: string, compradorId: string, ahora: Date): Promise<Compra[]> {
    return (await this.#compras.listarPorEventoYComprador(eventoId, compradorId)).filter((compra) =>
      compra.esVigente(ahora),
    );
  }
}
