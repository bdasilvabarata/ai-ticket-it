import { renderHook } from "@testing-library/react-native";
import { useEnvioUnico } from "../../../src/features/compras/useEnvioUnico";

describe("useEnvioUnico", () => {
  it("la primera llamada ejecuta el envío", async () => {
    const { result } = await renderHook(() => useEnvioUnico());
    const enviar = jest.fn();

    result.current(enviar);

    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("una segunda llamada antes de terminar no ejecuta otro envío", async () => {
    const { result } = await renderHook(() => useEnvioUnico());
    const primero = jest.fn();
    const segundo = jest.fn();

    result.current(primero);
    result.current(segundo);

    expect(primero).toHaveBeenCalledTimes(1);
    expect(segundo).not.toHaveBeenCalled();
  });

  it("después de terminar, vuelve a enviar", async () => {
    const { result } = await renderHook(() => useEnvioUnico());
    let terminar = () => {};
    const primero = jest.fn((alTerminar: () => void) => {
      terminar = alTerminar;
    });
    const segundo = jest.fn();

    result.current(primero);
    terminar();
    result.current(segundo);

    expect(segundo).toHaveBeenCalledTimes(1);
  });

  it("la marca sobrevive a un nuevo dibujo", async () => {
    const { result, rerender } = await renderHook(() => useEnvioUnico());
    const segundo = jest.fn();

    result.current(jest.fn());
    await rerender({});
    result.current(segundo);

    expect(segundo).not.toHaveBeenCalled();
  });
});
