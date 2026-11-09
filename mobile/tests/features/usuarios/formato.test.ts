import { nombreCompleto, textoEventosOrganizados } from "../../../src/features/usuarios/formato";

describe("formato de usuario (FR-015)", () => {
  it("nombreCompleto une nombre y apellido", () => {
    expect(nombreCompleto({ nombre: "Lucía", apellido: "Gómez" })).toBe("Lucía Gómez");
  });

  it.each([
    [0, "No organiza eventos"],
    [1, "Organiza 1 evento"],
    [3, "Organiza 3 eventos"],
  ])("textoEventosOrganizados(%i) → %s", (cantidad, esperado) => {
    expect(textoEventosOrganizados(cantidad)).toBe(esperado);
  });
});
