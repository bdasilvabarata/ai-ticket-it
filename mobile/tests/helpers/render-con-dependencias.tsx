import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderRouter } from "expo-router/testing-library";

import { crearDependencias, type Dependencias } from "../../src/composicion";
import { LayoutRaiz } from "../../src/navegacion/LayoutRaiz";
import { sinCompras } from "./compras";
import { crearFetchFalso, type FuncionRespuesta, type RespuestaFalsa, type Respuestas } from "./fetch-falso";
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

/**
 * Lo que pide la app sin que el test lo pida y responde vacío si no lo registra: el catálogo y las
 * categorías (Explorar), las compras del usuario en el evento (el detalle, feature 006, R19) y todas
 * sus compras ("Mis compras", feature 007).
 */
function respuestaDeExplorar(url: string): RespuestaFalsa | null {
  if (/\/eventos\?/.test(url)) return { status: 200, json: { eventos: [], hayEventosProximos: false } };
  if (url.endsWith("/categorias")) return { status: 200, json: [] };
  if (/\/eventos\/[^/]+\/mis-compras$/.test(url)) return { status: 200, json: sinCompras };
  if (/\/api\/compras$/.test(url)) return { status: 200, json: [] };
  return null;
}

/**
 * Explorar es la pestaña de inicio y pide el catálogo y las categorías apenas se confirma al
 * usuario (feature 005). En los tests que no registran esos pedidos (los de antes de la 005, cuando
 * Explorar era una sección pendiente) responden vacíos ("Todavía no hay eventos próximos."): una
 * lista de respuestas en orden no gasta una entrada en ellos y un `porRuta` sin sus rutas no falla.
 */
function conExplorarVacioSiFalta(respuestas: Respuestas): FuncionRespuesta {
  if (typeof respuestas === "function") {
    return (url, init) => {
      try {
        return respuestas(url, init);
      } catch (error) {
        const deExplorar = respuestaDeExplorar(url);
        if (deExplorar) return deExplorar;
        throw error;
      }
    };
  }
  let indice = 0;
  return (url, init) => {
    const deExplorar = respuestaDeExplorar(url);
    if (deExplorar) return deExplorar;
    if (respuestas.length === 0) throw new Error("crearFetchFalso: no hay respuestas configuradas");
    const elegida = respuestas[Math.min(indice, respuestas.length - 1)];
    indice += 1;
    return typeof elegida === "function" ? elegida(url, init) : elegida;
  };
}

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
  const falso = crearFetchFalso(conExplorarVacioSiFalta(respuestas));
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
