import { SecuenciaDeReintentos, type EstadoSecuencia } from "../../src/conexion/secuencia-reintentos";

/** `intentar` falso: cada llamada devuelve el siguiente resultado (repite el último). */
function crearIntentar(resultados: boolean[]) {
  let indice = 0;
  return jest.fn(async () => {
    const resultado = resultados[Math.min(indice, resultados.length - 1)];
    indice += 1;
    return resultado;
  });
}

async function avanzar(ms: number) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe("SecuenciaDeReintentos (FR-021a)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  it("expone las esperas 1, 2, 4, 8, 16 y 32 s", () => {
    expect(SecuenciaDeReintentos.esperasMs).toEqual([1000, 2000, 4000, 8000, 16000, 32000]);
  });

  it("intenta a los 1000 ms y no antes, y con fallos sigue a 2, 4, 8, 16 y 32 s", async () => {
    const intentar = crearIntentar([false]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(999);
    expect(intentar).toHaveBeenCalledTimes(0);
    await avanzar(1);
    expect(intentar).toHaveBeenCalledTimes(1);

    for (const [i, espera] of [2000, 4000, 8000, 16000, 32000].entries()) {
      await avanzar(espera - 1);
      expect(intentar).toHaveBeenCalledTimes(i + 1);
      await avanzar(1);
      expect(intentar).toHaveBeenCalledTimes(i + 2);
    }
  });

  it("después del sexto fallo no programa más y no le quedan automáticos", async () => {
    const intentar = crearIntentar([false]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    expect(secuencia.automaticosRestantes).toBe(6);
    secuencia.iniciar();
    await avanzar(63000);
    expect(intentar).toHaveBeenCalledTimes(6);
    expect(secuencia.automaticosRestantes).toBe(0);

    await avanzar(10 * 60 * 1000);
    expect(intentar).toHaveBeenCalledTimes(6);
  });

  it("un éxito cancela lo pendiente", async () => {
    const intentar = crearIntentar([false, true]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(3000);
    expect(intentar).toHaveBeenCalledTimes(2);
    await avanzar(10 * 60 * 1000);
    expect(intentar).toHaveBeenCalledTimes(2);
  });

  it("reintentarAhora intenta en el acto y, si falla, reinicia desde 1000 ms con 6 automáticos", async () => {
    const intentar = crearIntentar([false]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(3000); // dos automáticos fallidos
    expect(secuencia.automaticosRestantes).toBe(4);

    await secuencia.reintentarAhora();
    expect(intentar).toHaveBeenCalledTimes(3);
    expect(secuencia.automaticosRestantes).toBe(6);

    await avanzar(999);
    expect(intentar).toHaveBeenCalledTimes(3);
    await avanzar(1);
    expect(intentar).toHaveBeenCalledTimes(4);
  });

  it("reintentarAhora también funciona con la secuencia agotada", async () => {
    const intentar = crearIntentar([false, false, false, false, false, false, true]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(63000);
    expect(secuencia.automaticosRestantes).toBe(0);

    await secuencia.reintentarAhora();
    expect(intentar).toHaveBeenCalledTimes(7);
    await avanzar(10 * 60 * 1000);
    expect(intentar).toHaveBeenCalledTimes(7);
  });

  it("mientras un intento está en curso, reintentarAhora se ignora", async () => {
    let terminar: (ok: boolean) => void = () => {};
    const intentar = jest.fn(
      () =>
        new Promise<boolean>((resolver) => {
          terminar = resolver;
        }),
    );
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    void secuencia.reintentarAhora();
    expect(secuencia.enCurso).toBe(true);
    void secuencia.reintentarAhora();
    secuencia.iniciar();
    await avanzar(5000);
    expect(intentar).toHaveBeenCalledTimes(1);

    terminar(true);
    await avanzar(0);
    expect(secuencia.enCurso).toBe(false);
  });

  it("iniciar con la secuencia ya corriendo no la reinicia", async () => {
    const intentar = crearIntentar([false]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(1000); // primer automático; el próximo a los 2000 ms
    await avanzar(1500);
    secuencia.iniciar();
    await avanzar(500);
    expect(intentar).toHaveBeenCalledTimes(2);
  });

  it("una excepción de intentar cuenta como fallo", async () => {
    const intentar = jest.fn(async (): Promise<boolean> => {
      throw new Error("boom");
    });
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(3000);
    expect(intentar).toHaveBeenCalledTimes(2);
    expect(secuencia.automaticosRestantes).toBe(4);
  });

  it("detener cancela todo", async () => {
    const intentar = crearIntentar([false]);
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    secuencia.iniciar();
    await avanzar(1000);
    secuencia.detener();
    await avanzar(10 * 60 * 1000);
    expect(intentar).toHaveBeenCalledTimes(1);
    expect(secuencia.enCurso).toBe(false);
  });

  it("detener durante un intento descarta su resultado", async () => {
    let terminar: (ok: boolean) => void = () => {};
    const intentar = jest.fn(
      () =>
        new Promise<boolean>((resolver) => {
          terminar = resolver;
        }),
    );
    const secuencia = new SecuenciaDeReintentos({ intentar, alCambiar: () => {} });

    void secuencia.reintentarAhora();
    secuencia.detener();
    terminar(false);
    await avanzar(10 * 60 * 1000);
    expect(intentar).toHaveBeenCalledTimes(1);
  });

  it("el callback de cambios avisa enCurso y automaticosRestantes", async () => {
    const cambios: EstadoSecuencia[] = [];
    const secuencia = new SecuenciaDeReintentos({
      intentar: crearIntentar([false]),
      alCambiar: (estado) => cambios.push(estado),
    });

    secuencia.iniciar();
    await avanzar(1000);

    expect(cambios).toContainEqual({ enCurso: true, automaticosRestantes: 5 });
    expect(cambios.at(-1)).toEqual({ enCurso: false, automaticosRestantes: 5 });
  });
});
