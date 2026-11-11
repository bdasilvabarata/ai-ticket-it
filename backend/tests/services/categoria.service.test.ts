import { describe, expect, it, vi } from "vitest";
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

describe("CategoriaService.obtenerPorIds", () => {
  const musica = categoria("categoria-musica", "Música");
  const teatro = categoria("categoria-teatro", "Teatro");

  it("devuelve las categorías por id, en una sola lectura, aunque los ids se repitan", async () => {
    const repositorio = new CategoriaRepository([musica, teatro]);
    const lecturas = vi.spyOn(repositorio, "listarPorIds");
    const service = new CategoriaService({ categorias: repositorio });
    const porId = await service.obtenerPorIds(["categoria-teatro", "categoria-musica", "categoria-teatro"]);
    expect([...porId]).toEqual([
      ["categoria-teatro", teatro],
      ["categoria-musica", musica],
    ]);
    expect(lecturas).toHaveBeenCalledTimes(1);
  });

  it("sin ids devuelve un Map vacío", async () => {
    const service = new CategoriaService({ categorias: new CategoriaRepository([musica]) });
    expect((await service.obtenerPorIds([])).size).toBe(0);
  });

  it("si falta alguna lanza 404 CATEGORIA_NO_ENCONTRADA", async () => {
    const service = new CategoriaService({ categorias: new CategoriaRepository([musica]) });
    await expect(service.obtenerPorIds(["categoria-musica", "categoria-x"])).rejects.toMatchObject({
      constructor: NoEncontradoError,
      codigo: "CATEGORIA_NO_ENCONTRADA",
    });
  });
});
