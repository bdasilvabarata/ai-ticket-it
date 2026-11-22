import { claves } from "../../src/consultas/claves";

describe("claves.comprasDelEvento (feature 013)", () => {
  it("sin filtro ni página es el prefijo de dos ids que usan las invalidaciones de la 008 a la 011", () => {
    expect(claves.comprasDelEvento("usuario-lucia", "evento-festival")).toEqual([
      "compras-del-evento",
      "usuario-lucia",
      "evento-festival",
    ]);
  });

  it("con filtro y página los suma al final, así el prefijo alcanza todas las páginas y filtros", () => {
    expect(
      claves.comprasDelEvento("usuario-lucia", "evento-festival", { filtro: "CANCELADA", pagina: 2 }),
    ).toEqual(["compras-del-evento", "usuario-lucia", "evento-festival", { filtro: "CANCELADA", pagina: 2 }]);
  });
});

describe("claves.paginaDeResenias (feature 013, US5)", () => {
  it("suma la página al final de la clave del resumen, así el prefijo que invalida la reseña la alcanza", () => {
    const clave = claves.paginaDeResenias("usuario-diego", "evento-jazz", 2);
    expect(clave).toEqual(["resenias-del-organizador", "usuario-diego", "evento-jazz", "pagina", 2]);
    expect(clave.slice(0, 1)).toEqual(["resenias-del-organizador"]);
    expect(clave.slice(0, 3)).toEqual(claves.reseniasDelOrganizador("usuario-diego", "evento-jazz"));
  });
});
