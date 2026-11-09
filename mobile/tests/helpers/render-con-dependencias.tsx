import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderRouter } from "expo-router/testing-library";

import { crearDependencias, type Dependencias } from "../../src/composicion";
import { LayoutRaiz } from "../../src/navegacion/LayoutRaiz";
import { crearFetchFalso, type Respuestas } from "./fetch-falso";
import { CLAVE_RECORDADO } from "./usuarios";

export const URL_DE_PRUEBA = "http://servidor-de-prueba:3000/api";

type ComponenteDeRuta = () => React.ReactElement | null;

export interface OpcionesRender {
  respuestas: Respuestas;
  usuarioRecordado?: string;
  initialUrl?: string;
  /** Rutas de prueba que se suman a las de `app/` (por ejemplo, `"(tabs)/prueba"`). */
  rutasExtra?: Record<string, ComponenteDeRuta>;
}

const creadas: Dependencias[] = [];

// Cancela los pedidos colgados de cada test, para que no sigan corriendo en el siguiente.
afterEach(async () => {
  for (const dependencias of creadas.splice(0)) {
    await dependencias.queryClient.cancelQueries();
    dependencias.queryClient.clear();
  }
});

/**
 * Renderiza la app real (`app/`) con `LayoutRaiz` y dependencias de prueba: `fetch` falso, el mock
 * de AsyncStorage y un `QueryClient` nuevo (R12). `renderRouter` activa los temporizadores falsos.
 */
export async function renderConDependencias({
  respuestas,
  usuarioRecordado,
  initialUrl = "/",
  rutasExtra = {},
}: OpcionesRender) {
  if (usuarioRecordado !== undefined) {
    await AsyncStorage.setItem(CLAVE_RECORDADO, JSON.stringify({ version: 1, usuarioId: usuarioRecordado }));
  }
  const falso = crearFetchFalso(respuestas);
  const deps = crearDependencias({
    fetch: falso.fetch,
    almacenamiento: AsyncStorage,
    urlEntorno: URL_DE_PRUEBA,
  });
  creadas.push(deps);

  const resultado = await renderRouter(
    {
      appDir: "app", // relativo al cwd de Jest (mobile/)
      overrides: { _layout: () => <LayoutRaiz dependencias={deps} />, ...rutasExtra },
    },
    { initialUrl },
  );
  return { ...resultado, falso, deps };
}
