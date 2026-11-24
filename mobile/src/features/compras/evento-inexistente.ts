import { router } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

import { ErrorDeApi } from "../../api";

const NO_EXISTE = "No existe el evento.";

/** 404 `EVENTO_NO_ENCONTRADO`: el evento se borró (no confundir con `ENTRADA_NO_ENCONTRADA`). */
export function esEventoInexistente(error: unknown): boolean {
  return error instanceof ErrorDeApi && error.codigo === "EVENTO_NO_ENCONTRADO";
}

/** Avisa que el evento ya no existe y vuelve a "Mis eventos" (FR-024). */
export function salirPorEventoInexistente() {
  Alert.alert(NO_EXISTE);
  router.dismissTo("/mis-eventos");
}

/** Sale a "Mis eventos" una vez, cuando la consulta informa que el evento no existe. */
export function useSalirSiNoExisteElEvento(error: unknown) {
  const inexistente = esEventoInexistente(error);
  useEffect(() => {
    if (inexistente) salirPorEventoInexistente();
  }, [inexistente]);
}
