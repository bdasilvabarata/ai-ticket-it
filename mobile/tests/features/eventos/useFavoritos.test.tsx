import { screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";

import { claves } from "../../../src/consultas/claves";
import { useFavoritos, useIdsDeFavoritos } from "../../../src/features/eventos";
import { porRuta, type RespuestaFalsa } from "../../helpers/fetch-falso";
import { clasicoEnCatalogo, nocheDeRisasEnCatalogo, errorApi } from "../../helpers/eventos";
import { renderConDependencias } from "../../helpers/render-con-dependencias";
import { diego, todos } from "../../helpers/usuarios";

const FAVORITOS = "/usuarios/actual/favoritos";

/** Monta los dos hooks juntos y muestra lo que devuelve cada uno. */
function PantallaDePrueba() {
  const consulta = useFavoritos();
  const ids = useIdsDeFavoritos();
  return (
    <>
      <Text>{`estado: ${consulta.status}`}</Text>
      <Text>{`ids: ${[...ids].sort().join(",") || "ninguno"}`}</Text>
    </>
  );
}

async function abrir(favoritos: RespuestaFalsa[]) {
  return renderConDependencias({
    usuarioRecordado: diego.id,
    respuestas: porRuta({
      "/usuarios/actual": [{ status: 200, json: diego }],
      "/usuarios": [{ status: 200, json: todos }],
      [FAVORITOS]: favoritos,
    }),
    rutasExtra: { "(tabs)/index": PantallaDePrueba },
  });
}

describe("useFavoritos y useIdsDeFavoritos (feature 014)", () => {
  it("piden los favoritos con el usuario de la sesión, bajo claves.favoritos(usuarioId)", async () => {
    const { falso, deps } = await abrir([{ status: 200, json: [clasicoEnCatalogo] }]);

    expect(await screen.findByText("estado: success")).toBeOnTheScreen();
    const pedido = falso.pedidosA(FAVORITOS)[0];
    expect(pedido.metodo).toBe("GET");
    expect(pedido.encabezados["X-Usuario-Id"]).toBe(diego.id);
    expect(deps.queryClient.getQueryData(claves.favoritos(diego.id))).toEqual([clasicoEnCatalogo]);
  });

  it("con datos, los ids son los de los favoritos", async () => {
    await abrir([{ status: 200, json: [clasicoEnCatalogo, nocheDeRisasEnCatalogo] }]);

    expect(
      await screen.findByText(`ids: ${clasicoEnCatalogo.id},${nocheDeRisasEnCatalogo.id}`),
    ).toBeOnTheScreen();
  });

  it("mientras carga, el conjunto de ids está vacío", async () => {
    const { falso } = await abrir(["colgar"]);

    await waitFor(() => expect(falso.pedidosA(FAVORITOS)).toHaveLength(1));
    expect(screen.getByText("estado: pending")).toBeOnTheScreen();
    expect(screen.getByText("ids: ninguno")).toBeOnTheScreen();
  });

  it("con la consulta en error, el conjunto de ids está vacío (FR-018b)", async () => {
    await abrir([{ status: 500, json: errorApi("ERROR_INTERNO", "Falló el servidor.") }]);

    expect(await screen.findByText("estado: error")).toBeOnTheScreen();
    expect(screen.getByText("ids: ninguno")).toBeOnTheScreen();
  });

  it("los dos hooks montados juntos hacen una sola consulta", async () => {
    const { falso } = await abrir([{ status: 200, json: [clasicoEnCatalogo] }]);

    expect(await screen.findByText(`ids: ${clasicoEnCatalogo.id}`)).toBeOnTheScreen();
    expect(falso.pedidosA(FAVORITOS)).toHaveLength(1);
  });
});
