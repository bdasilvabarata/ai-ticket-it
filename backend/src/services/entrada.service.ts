import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { esCodigoValido, normalizarCodigo } from "../domain/codigo-de-entrada";
import type { Compra } from "../domain/compra";
import type { Evento } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras } from "../domain/repositorios";
import { exigirVentanaAbierta } from "../domain/ventana-de-uso";
import { EntradaNoEncontradaError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aEntradaDelEventoVista } from "./compra.vistas";
import type { EventoService } from "./evento.service";
import type { UsuarioService } from "./usuario.service";

export interface DependenciasEntradaService {
  compras: RepositorioCompras;
  eventoService: EventoService;
  usuarioService: UsuarioService;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/**
 * Casos de uso sobre las entradas de un evento, para su organizador (feature 008, R4): buscar una
 * por su código y registrar su uso. Escribe con `RepositorioCompras` (la `Entrada` vive dentro del
 * agregado `Compra`, como `TipoEntradaService` con `RepositorioEventos`); el evento se lo pide a
 * `EventoService` y el comprador a `UsuarioService`. No depende de `CompraService`.
 */
export class EntradaService {
  readonly #compras: RepositorioCompras;
  readonly #eventoService: EventoService;
  readonly #usuarioService: UsuarioService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ compras, eventoService, usuarioService, cerrojo, reloj }: DependenciasEntradaService) {
    this.#compras = compras;
    this.#eventoService = eventoService;
    this.#usuarioService = usuarioService;
    this.#cerrojo = cerrojo;
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
    const compra = await this.#buscarEnElEvento(eventoId, canonico);
    return this.#vista(compra.alDia(ahora), canonico, evento, ahora);
  }

  /**
   * Registra el uso de la entrada (R10). Todo bajo el cerrojo del evento, con un único `ahora`
   * leído adentro: 404 evento → 403 → materializa los vencimientos del evento → relee la compra por
   * código (404) → 409 fuera de la ventana → 409 transición inválida → **un** `guardar` de la compra.
   * El cupo no cambia (FR-009).
   */
  async registrarUso(eventoId: string, codigo: string, usuarioId: string): Promise<EntradaDelEventoVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      const canonico = normalizarCodigo(codigo);
      const compra = await this.#buscarEnElEvento(eventoId, canonico);
      exigirVentanaAbierta(evento.fechaHora, ahora);
      const usada = compra.alDia(ahora).registrarUso(canonico, usuarioId, ahora);
      await this.#compras.guardar(usada);
      return this.#vista(usada, canonico, evento, ahora);
    });
  }

  /** La compra de ese evento con una entrada de ese código canónico; si no hay (o es de otro evento), 404. */
  async #buscarEnElEvento(eventoId: string, codigo: string): Promise<Compra> {
    const compra = esCodigoValido(codigo) ? await this.#compras.buscarPorCodigoDeEntrada(codigo) : null;
    if (!compra || compra.eventoId !== eventoId) throw new EntradaNoEncontradaError();
    return compra;
  }

  async #vista(compra: Compra, codigo: string, evento: Evento, ahora: Date): Promise<EntradaDelEventoVista> {
    const comprador = await this.#usuarioService.obtenerOFallar(compra.compradorId);
    return aEntradaDelEventoVista(compra, codigo, comprador, evento, ahora);
  }
}
