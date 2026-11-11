import type { CategoriaVista } from "@ai-ticket-it/shared";
import { compararPorNombre, type Categoria } from "../domain/categoria";
import type { RepositorioCategorias } from "../domain/repositorios";
import { NoEncontradoError, ReferenciaInvalidaError } from "../errors/index";

/** Catálogo de categorías (solo lectura). Los otros services le piden acá sus categorías. */
export class CategoriaService {
  readonly #categorias: RepositorioCategorias;

  constructor({ categorias }: { categorias: RepositorioCategorias }) {
    this.#categorias = categorias;
  }

  /** Por nombre, sin distinguir mayúsculas ni tildes. */
  async listar(): Promise<CategoriaVista[]> {
    return (await this.#categorias.listar())
      .toSorted(compararPorNombre)
      .map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion }));
  }

  /** Único lugar del service que busca por id y lanza 404 si no existe. */
  async obtenerOFallar(id: string): Promise<Categoria> {
    const categoria = await this.#categorias.buscarPorId(id);
    if (!categoria) throw new NoEncontradoError("CATEGORIA_NO_ENCONTRADA", "No existe la categoría.");
    return categoria;
  }

  /**
   * La categoría que eligió el usuario (el `categoriaId` de la entrada): si no existe, no es un 404
   * del recurso pedido sino un dato inválido del cuerpo (400 sobre `body.categoriaId`).
   */
  async buscarReferenciada(id: string): Promise<Categoria> {
    try {
      return await this.obtenerOFallar(id);
    } catch (error) {
      if (error instanceof NoEncontradoError) throw new ReferenciaInvalidaError("categoriaId", error.mensaje);
      throw error;
    }
  }
}
