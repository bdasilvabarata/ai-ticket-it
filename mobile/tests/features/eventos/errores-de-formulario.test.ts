import { ErrorDeApi, ServidorNoDisponibleError } from "../../../src/api";
import { aNumeroParaEnviar, erroresDeFormulario } from "../../../src/features/eventos/errores-de-formulario";

const invalida = (detalles: { campo: string; mensaje: string }[]) =>
  new ErrorDeApi(400, "ENTRADA_INVALIDA", "Los datos enviados no son válidos.", detalles);

describe("errores de formulario (R13)", () => {
  it("un 400 lleva cada detalle de body.* a su campo", () => {
    expect(
      erroresDeFormulario(
        invalida([
          { campo: "body.nombre", mensaje: "Es obligatorio." },
          { campo: "body.multimedia.0", mensaje: "Debe ser una URL http o https." },
          { campo: "body.tiposEntrada.1.precio", mensaje: "Debe ser un entero mayor o igual a 0." },
        ]),
        "evento",
      ),
    ).toEqual({
      campos: {
        nombre: "Es obligatorio.",
        "multimedia.0": "Debe ser una URL http o https.",
        "tiposEntrada.1.precio": "Debe ser un entero mayor o igual a 0.",
      },
      mensajeGeneral: null,
    });
  });

  it("un detalle que no es del cuerpo va en el mensaje general", () => {
    expect(erroresDeFormulario(invalida([{ campo: "params.eventoId", mensaje: "No." }]), "evento")).toEqual({
      campos: {},
      mensajeGeneral: "Los datos enviados no son válidos.",
    });
  });

  it("409 FECHA_NO_FUTURA va en fechaHora", () => {
    const error = new ErrorDeApi(409, "FECHA_NO_FUTURA", "La fecha y hora del evento deben ser futuras.");
    expect(erroresDeFormulario(error, "evento")).toEqual({
      campos: { fechaHora: "La fecha y hora del evento deben ser futuras." },
      mensajeGeneral: null,
    });
  });

  it("409 NOMBRE_TIPO_ENTRADA_REPETIDO va en la sección de tipos (evento) o en el nombre (tipo)", () => {
    const error = new ErrorDeApi(409, "NOMBRE_TIPO_ENTRADA_REPETIDO", "Ya hay un tipo con ese nombre.");
    expect(erroresDeFormulario(error, "evento").campos).toEqual({
      tiposEntrada: "Ya hay un tipo con ese nombre.",
    });
    expect(erroresDeFormulario(error, "tipo").campos).toEqual({ nombre: "Ya hay un tipo con ese nombre." });
  });

  it("cualquier otro error va en el mensaje general con el mensaje del servidor", () => {
    expect(erroresDeFormulario(new ErrorDeApi(403, "SIN_PERMISO", "Solo el organizador."), "evento")).toEqual(
      {
        campos: {},
        mensajeGeneral: "Solo el organizador.",
      },
    );
    expect(erroresDeFormulario(new Error("x"), "tipo").mensajeGeneral).toBe("Ocurrió un error inesperado.");
  });

  it("sin servidor no hay mensaje propio: lo muestra la franja", () => {
    expect(erroresDeFormulario(new ServidorNoDisponibleError("http://x", "sin-conexion"), "evento")).toEqual({
      campos: {},
      mensajeGeneral: null,
    });
  });

  it.each([
    ["15000", 15000],
    ["0", 0],
    ["", null],
    ["   ", null],
    ["-1", "-1"],
    ["1.5", "1.5"],
    ["diez", "diez"],
  ])("aNumeroParaEnviar(%p) → %p", (texto, esperado) => {
    expect(aNumeroParaEnviar(texto)).toBe(esperado);
  });
});
