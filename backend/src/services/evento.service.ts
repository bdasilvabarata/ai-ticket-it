import type { EventoResumenVista } from "@ai-ticket-it/shared";
import type { Categoria } from "../domain/categoria";
import type { Evento } from "../domain/evento";
import type { Reloj } from "../domain/reloj";
import type { RepositorioCategorias, RepositorioEventos } from "../domain/repositorios";
import { aEventoResumenVista } from "./evento.vistas";

export interface DependenciasEventoService {
  eventos: RepositorioEventos;
  categorias: RepositorioCategorias;
  reloj: Reloj;
}

/** Próximos por fecha ascendente; después los realizados, del más reciente al más antiguo (FR-004). */
function compararParaMisEventos(a: EventoResumenVista, b: EventoResumenVista): number {
  if (a.realizado !== b.realizado) return a.realizado ? 1 : -1;
  const diferencia = Date.parse(a.fechaHora) - Date.parse(b.fechaHora);
  return a.realizado ? -diferencia : diferencia;
}

/**
 * Casos de uso de eventos (UC-04). Recibe sus dependencias por constructor (principio III): las
 * interfaces de repositorio y el reloj, la única referencia de "ahora".
 */
export class EventoService {
  readonly #eventos: RepositorioEventos;
  readonly #categorias: RepositorioCategorias;
  readonly #reloj: Reloj;

  constructor({ eventos, categorias, reloj }: DependenciasEventoService) {
    this.#eventos = eventos;
    this.#categorias = categorias;
    this.#reloj = reloj;
  }

  /** Los eventos que organiza el usuario actual, en el orden de Mis eventos. */
  async listarMios(usuarioId: string): Promise<EventoResumenVista[]> {
    const eventos = await this.#eventos.listarPorOrganizador(usuarioId);
    const categorias = new Map(
      (await this.#categorias.listar()).map((categoria) => [categoria.id, categoria]),
    );
    const ahora = this.#reloj.ahora();
    return eventos
      .map((evento) => aEventoResumenVista(evento, categoriaDe(evento, categorias), ahora))
      .toSorted(compararParaMisEventos);
  }
}

/** La categoría de un evento guardado siempre existe (se verifica al crear y al editar). */
function categoriaDe(evento: Evento, categorias: Map<string, Categoria>): Categoria {
  const categoria = categorias.get(evento.categoriaId);
  if (!categoria) throw new Error(`El evento ${evento.id} tiene una categoría inexistente.`);
  return categoria;
}
