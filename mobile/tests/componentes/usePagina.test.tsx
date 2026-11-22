import { act, renderHook } from "@testing-library/react-native";

import { usePagina } from "../../src/componentes/usePagina";

type Resultado = ReturnType<typeof usePagina>;
interface Props {
  criterio: string;
}

describe("usePagina", () => {
  it("empieza en la página 1 y cambia a la elegida", async () => {
    const { result } = await renderHook(() => usePagina("a"));
    expect(result.current[0]).toBe(1);

    await act(() => result.current[1](3));

    expect(result.current[0]).toBe(3);
  });

  it("con el mismo criterio conserva la página entre renders", async () => {
    const { result, rerender } = await renderHook<Resultado, Props>(({ criterio }) => usePagina(criterio), {
      initialProps: { criterio: "a" },
    });
    await act(() => result.current[1](4));

    await rerender({ criterio: "a" });

    expect(result.current[0]).toBe(4);
  });

  it("al cambiar el criterio vuelve a la 1 en el mismo render, sin efectos (FR-013)", async () => {
    const vistas: number[] = [];
    const { result, rerender } = await renderHook<Resultado, Props>(
      ({ criterio }) => {
        const resultado = usePagina(criterio);
        vistas.push(resultado[0]);
        return resultado;
      },
      { initialProps: { criterio: "a" } },
    );
    await act(() => result.current[1](3));
    vistas.length = 0;

    await rerender({ criterio: "b" });

    // Ningún render con el criterio nuevo vio la página vieja.
    expect(vistas).not.toContain(3);
    expect(result.current[0]).toBe(1);
  });

  it("con el criterio nuevo se puede volver a cambiar la página", async () => {
    const { result, rerender } = await renderHook<Resultado, Props>(({ criterio }) => usePagina(criterio), {
      initialProps: { criterio: "a" },
    });
    await act(() => result.current[1](3));
    await rerender({ criterio: "b" });

    await act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);

    await rerender({ criterio: "b" });
    expect(result.current[0]).toBe(2);
  });

  it("volver a un criterio anterior empieza en la 1, no en la página que tenía (FR-017)", async () => {
    const { result, rerender } = await renderHook<Resultado, Props>(({ criterio }) => usePagina(criterio), {
      initialProps: { criterio: "a" },
    });
    await act(() => result.current[1](2));

    await rerender({ criterio: "b" });
    await rerender({ criterio: "a" });

    expect(result.current[0]).toBe(1);
  });
});
