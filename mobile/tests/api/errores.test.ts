import { ErrorDeApi, ServidorNoDisponibleError } from "../../src/api";

describe("errores de la app", () => {
  it("ErrorDeApi extiende Error y expone status, codigo, mensaje y detalles", () => {
    const detalles = [{ campo: "body.cantidad", mensaje: "Tiene que ser positiva." }];
    const error = new ErrorDeApi(409, "CUPO_AGOTADO", "No quedan entradas.", detalles);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).not.toBeInstanceOf(ServidorNoDisponibleError);
    expect(error.status).toBe(409);
    expect(error.codigo).toBe("CUPO_AGOTADO");
    expect(error.mensaje).toBe("No quedan entradas.");
    expect(error.detalles).toEqual(detalles);
    expect(error.name).toBe("ErrorDeApi");
  });

  it("ErrorDeApi tiene detalles vacíos por defecto", () => {
    expect(new ErrorDeApi(500, "ERROR_INTERNO", "Falló.").detalles).toEqual([]);
  });

  it("ServidorNoDisponibleError extiende Error y expone url, motivo y el mensaje fijo", () => {
    const error = new ServidorNoDisponibleError("http://x:3000/api/usuarios", "tiempo-agotado");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ServidorNoDisponibleError);
    expect(error).not.toBeInstanceOf(ErrorDeApi);
    expect(error.url).toBe("http://x:3000/api/usuarios");
    expect(error.motivo).toBe("tiempo-agotado");
    expect(error.mensaje).toBe("No se pudo conectar con el servidor.");
    expect(error.name).toBe("ServidorNoDisponibleError");
  });
});
