import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Text } from "react-native";

import { ErrorDeApi, ServidorNoDisponibleError } from "../../src/api";
import { SegunConsulta, type ConsultaMostrable } from "../../src/componentes/SegunConsulta";
import { ConexionProvider, type EstadoConexion } from "../../src/conexion";

const URL_BASE = "http://servidor-de-prueba:3000/api";
const VACIO = "No hay nada.";

function crearConexion(cambios: Partial<EstadoConexion> = {}): EstadoConexion {
  return {
    servidor: "disponible",
    enCurso: false,
    automaticosRestantes: 6,
    reintentarAhora: jest.fn(async () => undefined),
    urlBase: URL_BASE,
    ...cambios,
  };
}

function consulta<T>(cambios: Partial<ConsultaMostrable<T>>): ConsultaMostrable<T> {
  return {
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    isFetching: false,
    refetch: jest.fn(),
    ...cambios,
  };
}

function renderConConexion(elemento: ReactElement, conexion = crearConexion()) {
  return render(<ConexionProvider valor={conexion}>{elemento}</ConexionProvider>);
}

function Lista({ c, esVacio }: { c: ConsultaMostrable<string[] | null>; esVacio?: (d: unknown) => boolean }) {
  return (
    <SegunConsulta consulta={c} mensajeVacio={VACIO} esVacio={esVacio}>
      {(datos) => <Text>{`Datos: ${datos?.join(", ")}`}</Text>}
    </SegunConsulta>
  );
}

/** Se limpia siempre, también si el test falla: si no, sus temporizadores dejan a Jest colgado. */
let queryClient: QueryClient | null = null;

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
});

describe("SegunConsulta (FR-013, research R8)", () => {
  it("pendiente → Cargando…", async () => {
    await renderConConexion(<Lista c={consulta({ isPending: true })} />);

    expect(screen.getByText("Cargando…")).toBeOnTheScreen();
  });

  it("servidor no disponible → mensaje con la dirección; Reintentar usa la secuencia, no refetch", async () => {
    const conexion = crearConexion();
    const c = consulta<string[] | null>({
      isError: true,
      error: new ServidorNoDisponibleError(`${URL_BASE}/x`, "sin-conexion"),
    });
    await renderConConexion(<Lista c={c} />, conexion);

    expect(screen.getByText("Servidor no disponible")).toBeOnTheScreen();
    expect(screen.getByText(`No se pudo conectar con ${URL_BASE}.`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(conexion.reintentarAhora).toHaveBeenCalledTimes(1);
    expect(c.refetch).not.toHaveBeenCalled();
  });

  it("servidor no disponible con la secuencia en curso → Reintentando… deshabilitado", async () => {
    const c = consulta<string[] | null>({
      isError: true,
      error: new ServidorNoDisponibleError(`${URL_BASE}/x`, "tiempo-agotado"),
    });
    await renderConConexion(<Lista c={c} />, crearConexion({ enCurso: true }));

    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
  });

  it("ErrorDeApi → su mensaje; Reintentar llama a refetch", async () => {
    const conexion = crearConexion();
    const c = consulta<string[] | null>({
      isError: true,
      error: new ErrorDeApi(500, "ERROR_INTERNO", "Falló el servidor."),
    });
    await renderConConexion(<Lista c={c} />, conexion);

    expect(screen.getByText("Falló el servidor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(c.refetch).toHaveBeenCalledTimes(1);
    expect(conexion.reintentarAhora).not.toHaveBeenCalled();
  });

  it("ErrorDeApi mientras vuelve a pedir → Reintentando…", async () => {
    const c = consulta<string[] | null>({
      isError: true,
      isFetching: true,
      error: new ErrorDeApi(500, "ERROR_INTERNO", "Falló el servidor."),
    });
    await renderConConexion(<Lista c={c} />);

    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
  });

  it("error de otro tipo → Ocurrió un error inesperado.", async () => {
    await renderConConexion(<Lista c={consulta({ isError: true, error: new Error("raro") })} />);

    expect(screen.getByText("Ocurrió un error inesperado.")).toBeOnTheScreen();
  });

  it.each([
    ["[]", []],
    ["undefined", undefined],
    ["null", null],
  ])("datos %s → mensaje de vacío", async (_nombre, data) => {
    await renderConConexion(<Lista c={consulta<string[] | null>({ data })} />);

    expect(screen.getByText(VACIO)).toBeOnTheScreen();
  });

  it("respeta un esVacio propio", async () => {
    await renderConConexion(<Lista c={consulta<string[] | null>({ data: ["a"] })} esVacio={() => true} />);

    expect(screen.getByText(VACIO)).toBeOnTheScreen();
  });

  it("con datos → children(datos)", async () => {
    await renderConConexion(<Lista c={consulta<string[] | null>({ data: ["a", "b"] })} />);

    expect(screen.getByText("Datos: a, b")).toBeOnTheScreen();
  });

  it("cancelar un refetch colgado con datos cargados sigue mostrando los datos, sin error", async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    queryClient = cliente;
    let pedidos = 0;
    const pedir = ({ signal }: { signal: AbortSignal }) => {
      pedidos += 1;
      if (pedidos === 1) return Promise.resolve(["a"]);
      return new Promise<string[]>((_resolver, rechazar) => {
        signal.addEventListener("abort", () => rechazar(new Error("cancelado")));
      });
    };
    function ConQuery() {
      const c = useQuery({ queryKey: ["prueba"], queryFn: pedir });
      return <Lista c={c} />;
    }

    await renderConConexion(
      <QueryClientProvider client={cliente}>
        <ConQuery />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Datos: a")).toBeOnTheScreen();

    await act(async () => {
      void cliente.refetchQueries({ queryKey: ["prueba"] });
    });
    await act(() => cliente.cancelQueries());

    expect(pedidos).toBe(2);
    expect(screen.getByText("Datos: a")).toBeOnTheScreen();
    expect(screen.queryByText("Ocurrió un error inesperado.")).toBeNull();
  });
});

describe("SegunConsulta: cargando y vacío propios (feature 005)", () => {
  it("con cargando, lo muestra en lugar de Cargando…", async () => {
    await renderConConexion(
      <SegunConsulta
        consulta={consulta<string[]>({ isPending: true })}
        mensajeVacio={VACIO}
        cargando={<Text>Esqueleto</Text>}
      >
        {() => <Text>Datos</Text>}
      </SegunConsulta>,
    );

    expect(screen.getByText("Esqueleto")).toBeOnTheScreen();
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("con vacio, lo muestra en lugar de ListaVacia", async () => {
    await renderConConexion(
      <SegunConsulta consulta={consulta<string[]>({ data: [] })} vacio={<Text>Vacío propio</Text>}>
        {() => <Text>Datos</Text>}
      </SegunConsulta>,
    );

    expect(screen.getByText("Vacío propio")).toBeOnTheScreen();
    expect(screen.queryByText(VACIO)).toBeNull();
  });

  it("con datos, cargando y vacio no se ven", async () => {
    await renderConConexion(
      <SegunConsulta
        consulta={consulta<string[]>({ data: ["a"] })}
        vacio={<Text>Vacío propio</Text>}
        cargando={<Text>Esqueleto</Text>}
      >
        {(datos) => <Text>{`Datos: ${datos.join(", ")}`}</Text>}
      </SegunConsulta>,
    );

    expect(screen.getByText("Datos: a")).toBeOnTheScreen();
  });
});
