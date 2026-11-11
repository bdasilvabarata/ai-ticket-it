import { describe, expect, it } from "vitest";
import { Categoria } from "../../src/domain/categoria";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { NoEncontradoError, ReferenciaInvalidaError } from "../../src/errors/index";
import { CategoriaService } from "../../src/services/categoria.service";

const categoria = (id: string, nombre: string) => new Categoria({ id, nombre, descripcion: `De ${nombre}.` });

describe("CategoriaService.listar", () => {
  it("devuelve las vistas ordenadas por nombre, sin distinguir mayúsculas ni tildes", async () => {
    const service = new CategoriaService({
      categorias: new CategoriaRepository([
        categoria("categoria-teatro", "Teatro"),
        categoria("categoria-musica", "Música"),
        categoria("categoria-arte", "arte"),
        categoria("categoria-stand-up", "Stand-up"),
      ]),
    });
    expect(await service.listar()).toEqual([
      { id: "categoria-arte", nombre: "arte", descripcion: "De arte." },
      { id: "categoria-musica", nombre: "Música", descripcion: "De Música." },
      { id: "categoria-stand-up", nombre: "Stand-up", descripcion: "De Stand-up." },
      { id: "categoria-teatro", nombre: "Teatro", descripcion: "De Teatro." },
    ]);
  });

  it("sin categorías devuelve []", async () => {
    expect(await new CategoriaService({ categorias: new CategoriaRepository() }).listar()).toEqual([]);
  });
});

describe("CategoriaService: búsqueda por id", () => {
  const musica = categoria("categoria-musica", "Música");
  const service = new CategoriaService({ categorias: new CategoriaRepository([musica]) });

  it("obtenerOFallar devuelve la entidad o lanza 404 CATEGORIA_NO_ENCONTRADA", async () => {
    expect(await service.obtenerOFallar("categoria-musica")).toBe(musica);
    await expect(service.obtenerOFallar("categoria-x")).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "CATEGORIA_NO_ENCONTRADA",
    });
  });

  it("buscarReferenciada devuelve la entidad o lanza una referencia inválida a categoriaId", async () => {
    expect(await service.buscarReferenciada("categoria-musica")).toBe(musica);
    await expect(service.buscarReferenciada("categoria-x")).rejects.toMatchObject({
      constructor: ReferenciaInvalidaError,
      campo: "categoriaId",
      mensaje: "No existe la categoría.",
    });
  });
});
