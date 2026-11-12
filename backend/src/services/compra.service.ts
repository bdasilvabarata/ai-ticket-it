import {
  EstadoCompra,
  type CompraVista,
  type DatosCompra,
  type MisComprasDelEventoVista,
} from "@ai-ticket-it/shared";
import { Compra } from "../domain/compra";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras } from "../domain/repositorios";
import { entradasRestantes, exigirTopePorPersona } from "../domain/tope-por-persona";
import { CompraNoEncontradaError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aCompraVista } from "./compra.vistas";
import type { EventoService } from "./evento.service";
import type { TipoEntradaService } from "./tipo-entrada.service";

export interface DependenciasCompraService {
  compras: RepositorioCompras;
  eventoService: EventoService;
  tipoEntradaService: TipoEntradaService;
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
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ compras, eventoService, tipoEntradaService, cerrojo, reloj }: DependenciasCompraService) {
    this.#compras = compras;
    this.#eventoService = eventoService;
    this.#tipoEntradaService = tipoEntradaService;
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
        ahora,
      });
      await this.#compras.guardar(compra);
      return aCompraVista(compra, descontado, ahora);
    });
  }

  /**
   * Lo que el detalle del evento necesita saber del usuario actual: sus compras pendientes no
   * vencidas (de la más vieja a la más nueva) y cuántas entradas más puede comprar de cada tipo
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
      restantesPorTipo: evento.tiposEntrada.map((tipo) => ({
        tipoEntradaId: tipo.id,
        restantes: organiza ? 0 : entradasRestantes(tipo, vigentes),
      })),
    };
  }

  /** Sus compras de ese evento que cuentan para el tope en `ahora` (PENDIENTE no vencidas y CONFIRMADA). */
  async #vigentes(eventoId: string, compradorId: string, ahora: Date): Promise<Compra[]> {
    return (await this.#compras.listarPorEventoYComprador(eventoId, compradorId)).filter((compra) =>
      compra.esVigente(ahora),
    );
  }
}
