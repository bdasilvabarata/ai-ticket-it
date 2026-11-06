import { describe, expect, it } from "vitest";
import { ErrorArranque, mensajeFallaArranque } from "../../src/config/fallas-arranque";

describe("mensajeFallaArranque", () => {
  it("explica que el puerto está en uso", () => {
    const error = Object.assign(new Error("listen EADDRINUSE"), { code: "EADDRINUSE" });
    expect(mensajeFallaArranque(error, 3000)).toContain("El puerto 3000 ya está en uso");
  });

  it("usa el mensaje propio de un ErrorArranque", () => {
    expect(mensajeFallaArranque(new ErrorArranque("No hay base"), 3000)).toBe("No hay base");
  });

  it("envuelve cualquier otro Error", () => {
    expect(mensajeFallaArranque(new Error("boom"), 3000)).toBe("No se pudo arrancar el servidor: boom");
  });

  it("no rompe con un valor que no es Error", () => {
    expect(mensajeFallaArranque("algo raro", 3000)).toContain("algo raro");
  });
});
