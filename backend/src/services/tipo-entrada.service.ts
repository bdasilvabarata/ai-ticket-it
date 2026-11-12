import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import { TipoEntrada, type DatosDeTipoEntrada, type Evento } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import { NoEncontradoError, ReferenciaInvalidaError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import type { EventoService } from "./evento.service";
import { aTipoEntradaVista } from "./evento.vistas";

export interface DependenciasTipoEntradaService {
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  eventoService: EventoService;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/**
 * Casos de uso de los tipos de entrada de un evento. `TipoEntrada` vive dentro del agregado
 * `Evento`: el evento se lo pide a `EventoService` (que responde el 404 y el 403) y se guarda con
 * `RepositorioEventos`. Cada escritura corre bajo el cerrojo del evento (el mismo que usa
 * `EventoService`), lee el reloj una vez adentro, relee el evento al día (con los vencimientos de
 * sus compras ya materializados; 006, R3) y verifica en el orden de R5: 404 evento → 403 → 404 tipo
 * → 409.
 */
export class TipoEntradaService {
  readonly #eventos: RepositorioEventos;
  readonly #compras: RepositorioCompras;
  readonly #eventoService: EventoService;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ eventos, compras, eventoService, cerrojo, reloj }: DependenciasTipoEntradaService) {
    this.#eventos = eventos;
    this.#compras = compras;
    this.#eventoService = eventoService;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  async crear(eventoId: string, usuarioId: string, datos: DatosDeTipoEntrada): Promise<TipoEntradaVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      const tipo = new TipoEntrada({ ...datos, id: this.#eventos.siguienteId() });
      await this.#eventos.guardar(evento.agregarTipoEntrada(tipo, ahora));
      return aTipoEntradaVista(tipo);
    });
  }

  /** Cambiar el precio no toca ninguna compra: su total quedó fijo al comprar (FR-015). */
  async actualizar(
    eventoId: string,
    tipoId: string,
    usuarioId: string,
    datos: DatosDeTipoEntrada,
  ): Promise<TipoEntradaVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      this.#obtenerTipoOFallar(evento, tipoId);
      const actualizado = evento.editarTipoEntrada(tipoId, datos, ahora);
      await this.#eventos.guardar(actualizado);
      return aTipoEntradaVista(this.#obtenerTipoOFallar(actualizado, tipoId));
    });
  }

  async eliminar(eventoId: string, tipoId: string, usuarioId: string): Promise<void> {
    await this.#cerrojo.ejecutar(eventoId, async () => {
      const ahora = this.#reloj.ahora();
      const evento = await this.#eventoService.obtenerDelOrganizador(eventoId, usuarioId, ahora);
      this.#obtenerTipoOFallar(evento, tipoId);
      const tieneCompras = await this.#compras.existePorTipoEntrada(tipoId);
      await this.#eventos.guardar(evento.quitarTipoEntrada(tipoId, { ahora, tieneCompras }));
    });
  }

  /**
   * El tipo al que apunta `tipoEntradaId` del cuerpo de una compra: si no es de **este** evento,
   * `ReferenciaInvalidaError` (400 sobre `body.tipoEntradaId`), no 404: la ruta sí existe. Se usa
   * dentro del cerrojo de quien llama, sobre el evento que ya releyó.
   */
  buscarReferenciada(evento: Evento, tipoId: string): TipoEntrada {
    const tipo = evento.buscarTipoEntrada(tipoId);
    if (!tipo)
      throw new ReferenciaInvalidaError("tipoEntradaId", "No existe el tipo de entrada en este evento.");
    return tipo;
  }

  /**
   * Descuenta el cupo de una compra y guarda el evento (el dueño del agregado escribe; R4). Corre
   * **dentro** del cerrojo de quien llama, sin tomarlo; si el dominio rechaza, no guarda nada.
   */
  async descontarCupo(evento: Evento, tipoId: string, cantidad: number, ahora: Date): Promise<Evento> {
    const descontado = evento.descontarCupo(tipoId, cantidad, ahora);
    await this.#eventos.guardar(descontado);
    return descontado;
  }

  /**
   * Devuelve al cupo las entradas de una compra que su comprador canceló y guarda el evento. Como
   * `descontarCupo`, corre **dentro** del cerrojo de quien llama; sin chequeo de "realizado" (una
   * pendiente se cancela también con el evento empezado).
   */
  async devolverCupo(evento: Evento, tipoId: string, cantidad: number): Promise<Evento> {
    const devuelto = evento.devolverCupos(new Map([[tipoId, cantidad]]));
    await this.#eventos.guardar(devuelto);
    return devuelto;
  }

  /** 404 si el tipo no es de **este** evento (FR-023), aunque exista en otro. */
  #obtenerTipoOFallar(evento: Evento, tipoId: string): TipoEntrada {
    const tipo = evento.buscarTipoEntrada(tipoId);
    if (!tipo) {
      throw new NoEncontradoError(
        "TIPO_ENTRADA_NO_ENCONTRADO",
        "No existe el tipo de entrada en este evento.",
      );
    }
    return tipo;
  }
}
