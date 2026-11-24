import { useFonts } from "expo-font";
import { useState } from "react";

import { fuentes } from "../componentes";
import { crearDependenciasDeProduccion } from "../composicion";
import { LayoutRaiz } from "./LayoutRaiz";

/**
 * Raíz real de la app (research R3): arma las dependencias de producción una sola vez y espera a
 * las fuentes del tema. Si no cargan, sigue con las del sistema.
 */
export function RaizDeLaApp() {
  const [dependencias] = useState(crearDependenciasDeProduccion);
  const [cargadas, error] = useFonts(fuentes);
  if (!cargadas && !error) return null;
  return <LayoutRaiz dependencias={dependencias} />;
}
