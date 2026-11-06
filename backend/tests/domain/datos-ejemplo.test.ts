import { describe, expect, it } from "vitest";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { Categoria } from "../../src/domain/categoria";
import { Evento, TipoEntrada } from "../../src/domain/evento";
import { Usuario } from "../../src/domain/usuario";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ahora = new Date("2026-11-03T15:30:00.000Z");
const datos = crearDatosEjemplo(ahora);
const { categorias, usuarios, eventos } = datos;
const tipos = eventos.flatMap((evento) => evento.tiposEntrada);

function contarPorOrganizador(): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const evento of eventos) {
    cuenta.set(evento.organizadorId, (cuenta.get(evento.organizadorId) ?? 0) + 1);
  }
  return cuenta;
}

describe("crearDatosEjemplo", () => {
  it("tiene 6 categorías", () => {
    expect(categorias.length).toBeGreaterThanOrEqual(5);
    expect(categorias).toHaveLength(6);
  });

  it("tiene 5 usuarios: 101–103 organizan 3, 3 y 2; 104 y 105 ninguno", () => {
    expect(usuarios).toHaveLength(5);
    const cuenta = contarPorOrganizador();
    expect(cuenta.get("000000000000000000000101")).toBe(3);
    expect(cuenta.get("000000000000000000000102")).toBe(3);
    expect(cuenta.get("000000000000000000000103")).toBe(2);
    expect(cuenta.has("000000000000000000000104")).toBe(false);
    expect(cuenta.has("000000000000000000000105")).toBe(false);
    const organizan = usuarios.filter((usuario) => cuenta.has(usuario.id));
    expect(organizan.length).toBeGreaterThanOrEqual(2);
    expect(usuarios.length - organizan.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene 8 eventos de varios organizadores y categorías, cada uno con al menos un tipo", () => {
    expect(eventos).toHaveLength(8);
    expect(new Set(eventos.map((evento) => evento.organizadorId)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(eventos.map((evento) => evento.categoriaId)).size).toBeGreaterThanOrEqual(2);
    for (const evento of eventos) expect(evento.tiposEntrada.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene al menos 2 eventos ya realizados", () => {
    const pasados = eventos.filter((evento) => evento.fechaHora.getTime() < ahora.getTime());
    expect(pasados.length).toBeGreaterThanOrEqual(2);
  });

  it("tiene al menos un evento en las próximas 48 h", () => {
    const proximos = eventos.filter((evento) => {
      const t = evento.fechaHora.getTime();
      return t > ahora.getTime() && t <= ahora.getTime() + 48 * HORA;
    });
    expect(proximos.length).toBeGreaterThanOrEqual(1);
  });

  it("tiene un evento con varios tipos y un tipo con cupo de 3 o menos", () => {
    expect(eventos.some((evento) => evento.tiposEntrada.length > 1)).toBe(true);
    expect(tipos.some((tipo) => tipo.cupo <= 3)).toBe(true);
  });

  it("tiene precios muy distintos (máximo ≥ 10 × mínimo)", () => {
    const precios = tipos.map((tipo) => tipo.precio);
    expect(Math.max(...precios) / Math.min(...precios)).toBeGreaterThanOrEqual(10);
  });

  it("usa precios y cupos enteros no negativos", () => {
    for (const tipo of tipos) {
      expect(Number.isInteger(tipo.precio) && tipo.precio >= 0).toBe(true);
      expect(Number.isInteger(tipo.cupo) && tipo.cupo >= 0).toBe(true);
    }
  });

  it("usa ids de 24 hex, únicos y con el prefijo de cada tipo", () => {
    const grupos: [string[], string][] = [
      [usuarios.map((u) => u.id), "0001"],
      [categorias.map((c) => c.id), "0002"],
      [eventos.map((e) => e.id), "0003"],
      [tipos.map((t) => t.id), "0004"],
    ];
    const todos: string[] = [];
    for (const [ids, prefijo] of grupos) {
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{24}$/);
        expect(id).toMatch(new RegExp(`^0{18}${prefijo}\\d{2}$`));
      }
      todos.push(...ids);
    }
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("es determinista para el mismo ahora", () => {
    expect(crearDatosEjemplo(new Date(ahora))).toEqual(datos);
  });

  it("desplaza las fechas junto con ahora", () => {
    const despues = crearDatosEjemplo(new Date(ahora.getTime() + 7 * DIA));
    despues.eventos.forEach((evento, i) => {
      expect(evento.id).toBe(eventos[i]?.id);
      expect(evento.fechaHora.getTime() - (eventos[i]?.fechaHora.getTime() ?? 0)).toBe(7 * DIA);
    });
  });

  it("solo referencia organizadores y categorías existentes", () => {
    const idsUsuarios = new Set(usuarios.map((u) => u.id));
    const idsCategorias = new Set(categorias.map((c) => c.id));
    for (const evento of eventos) {
      expect(idsUsuarios.has(evento.organizadorId)).toBe(true);
      expect(idsCategorias.has(evento.categoriaId)).toBe(true);
    }
  });

  it("deja los favoritos vacíos", () => {
    for (const usuario of usuarios) expect(usuario.favoritos).toEqual([]);
  });

  it("construye entidades de dominio, así sus invariantes validan los datos de ejemplo", () => {
    const { categorias, usuarios, eventos } = crearDatosEjemplo(new Date("2026-11-06T15:00:00Z"));
    for (const categoria of categorias) expect(categoria).toBeInstanceOf(Categoria);
    for (const usuario of usuarios) expect(usuario).toBeInstanceOf(Usuario);
    for (const evento of eventos) {
      expect(evento).toBeInstanceOf(Evento);
      for (const tipo of evento.tiposEntrada) expect(tipo).toBeInstanceOf(TipoEntrada);
    }
  });
});
