import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderRouter } from "expo-router/testing-library";

import { crearDependencias, type Dependencias } from "../../src/composicion";
import { LayoutRaiz } from "../../src/navegacion/LayoutRaiz";
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

/** Las consultas del catálogo de Explorar (`GET /eventos?…`). */
const ES_CATALOGO = /\/eventos\?/;

/** Lo que responde el catálogo si el test no lo registra: vacío, sin eventos próximos. */
const CATALOGO_VACIO: RespuestaFalsa = { status: 200, json: { eventos: [], hayEventosProximos: false } };

/**
 * Explorar es la pestaña de inicio y pide el catálogo apenas se confirma al usuario (feature 005).
 * En los tests que no registran ese pedido (los de antes de la 005, cuando Explorar era una sección
 * pendiente) el catálogo responde vacío ("Todavía no hay eventos próximos."): una lista de
 * respuestas en orden no gasta una entrada en él y un `porRuta` sin la ruta del catálogo no falla.
 */
function conCatalogoVacioSiFalta(respuestas: Respuestas): FuncionRespuesta {
  if (typeof respuestas === "function") {
    return (url, init) => {
      try {
        return respuestas(url, init);
      } catch (error) {
        if (ES_CATALOGO.test(url)) return CATALOGO_VACIO;
        throw error;
      }
    };
  }
  let indice = 0;
  return (url, init) => {
    if (ES_CATALOGO.test(url)) return CATALOGO_VACIO;
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
  const falso = crearFetchFalso(conCatalogoVacioSiFalta(respuestas));
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
