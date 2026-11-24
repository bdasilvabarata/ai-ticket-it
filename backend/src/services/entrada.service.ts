import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { normalizarCodigo } from "../domain/codigo-de-entrada";
import type { Compra } from "../domain/compra";
import type { Evento } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { CompraService } from "./compra.service";
import { aEntradaDelEventoVista } from "./compra.vistas";
import type { EventoService } from "./evento.service";
import type { UsuarioService } from "./usuario.service";

export interface DependenciasEntradaService {
  compraService: CompraService;
  eventoService: EventoService;
  usuarioService: UsuarioService;
  reloj: Reloj;
}

/**
 * Casos de uso sobre las entradas de un evento, para su organizador (feature 008, R4): buscar una
 * por su código y registrar su uso. No escribe compras: el uso lo registra `CompraService`, dueño de
 * `Compra` (la `Entrada` vive dentro de ese agregado; feature 010, R3), que también es el único que
 * busca una compra por código. El evento se lo pide a `EventoService` y el comprador a
 * `UsuarioService`.
 */
export class EntradaService {
  readonly #compraService: CompraService;
  readonly #eventoService: EventoService;
  readonly #usuarioService: UsuarioService;
  readonly #reloj: Reloj;

  constructor({ compraService, eventoService, usuarioService, reloj }: DependenciasEntradaService) {
    this.#compraService = compraService;
    this.#eventoService = eventoService;
    this.#usuarioService = usuarioService;
    this.#reloj = reloj;
  }

  /**
   * La entrada de ese evento con ese código (normalizado), con su compra al día y la ventana de uso
   * (FR-012c). 404 evento → 403 → 404 entrada. Que no se pueda usar no es un error: la vista trae su
   * estado y el de la ventana (FR-019). Lectura: sin cerrojo y sin guardar.
   */
  async obtener(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista> {
    const ahora = this.#reloj.ahora();
    const evento = await this.#eventoService.leerDelOrganizador(eventoId, usuarioId, ahora);
    const canonico = normalizarCodigo(codigo);
    const compra = await this.#compraService.obtenerPorCodigoOFallar(eventoId, canonico);
    return this.#vista(compra.alDia(ahora), canonico, evento, ahora);
  }

  /** Registra el uso de la entrada: lo hace `CompraService`, dueño de `Compra` (feature 010, R3/R4). */
  async registrarUso(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista> {
    return this.#compraService.registrarUso(eventoId, codigo, usuarioId);
  }

  async #vista(compra: Compra, codigo: string, evento: Evento, ahora: Date): Promise<EntradaDelEventoVista> {
    const comprador = await this.#usuarioService.obtenerOFallar(compra.compradorId);
    return aEntradaDelEventoVista(compra, codigo, comprador, evento, ahora);
  }
}
