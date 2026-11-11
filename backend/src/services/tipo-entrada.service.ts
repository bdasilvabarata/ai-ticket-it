import { randomUUID } from "node:crypto";
import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import { TipoEntrada, type DatosDeTipoEntrada, type Evento } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCompras, RepositorioEventos } from "../domain/repositorios";
import { NoEncontradoError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";
import { aTipoEntradaVista } from "./evento.vistas";
import { exigirOrganizador } from "./organizador";

export interface DependenciasTipoEntradaService {
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  cerrojo: Cerrojo;
  reloj: Reloj;
}

/**
 * Casos de uso de los tipos de entrada de un evento. `TipoEntrada` vive dentro del agregado
 * `Evento`: se lee y se guarda con `RepositorioEventos`. Cada escritura corre bajo el cerrojo del
 * evento (el mismo que usa `EventoService`), relee el evento y verifica en el orden de R5:
 * 404 evento → 403 → 404 tipo → 409.
 */
export class TipoEntradaService {
  readonly #eventos: RepositorioEventos;
  readonly #compras: RepositorioCompras;
  readonly #cerrojo: Cerrojo;
  readonly #reloj: Reloj;

  constructor({ eventos, compras, cerrojo, reloj }: DependenciasTipoEntradaService) {
    this.#eventos = eventos;
    this.#compras = compras;
    this.#cerrojo = cerrojo;
    this.#reloj = reloj;
  }

  async crear(eventoId: string, usuarioId: string, datos: DatosDeTipoEntrada): Promise<TipoEntradaVista> {
    return this.#cerrojo.ejecutar(eventoId, async () => {
      const evento = await this.#obtenerEventoOFallar(eventoId);
      exigirOrganizador(evento, usuarioId);
      const tipo = new TipoEntrada({ ...datos, id: randomUUID() });
      await this.#eventos.guardar(evento.agregarTipoEntrada(tipo, this.#reloj.ahora()));
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
      const evento = await this.#obtenerEventoOFallar(eventoId);
      exigirOrganizador(evento, usuarioId);
      this.#obtenerTipoOFallar(evento, tipoId);
      const actualizado = evento.editarTipoEntrada(tipoId, datos, this.#reloj.ahora());
      await this.#eventos.guardar(actualizado);
      return aTipoEntradaVista(this.#obtenerTipoOFallar(actualizado, tipoId));
    });
  }

  async eliminar(eventoId: string, tipoId: string, usuarioId: string): Promise<void> {
    await this.#cerrojo.ejecutar(eventoId, async () => {
      const evento = await this.#obtenerEventoOFallar(eventoId);
      exigirOrganizador(evento, usuarioId);
      this.#obtenerTipoOFallar(evento, tipoId);
      const tieneCompras = await this.#compras.existePorTipoEntrada(tipoId);
      await this.#eventos.guardar(
        evento.quitarTipoEntrada(tipoId, { ahora: this.#reloj.ahora(), tieneCompras }),
      );
    });
  }

  /** Único lugar del service que busca el evento por id y lanza 404 si no existe. */
  async #obtenerEventoOFallar(eventoId: string): Promise<Evento> {
    const evento = await this.#eventos.buscarPorId(eventoId);
    if (!evento) throw new NoEncontradoError("EVENTO_NO_ENCONTRADO", "No existe el evento.");
    return evento;
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
