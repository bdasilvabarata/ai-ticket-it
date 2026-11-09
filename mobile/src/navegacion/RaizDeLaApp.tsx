import { useState } from "react";

import { crearDependenciasDeProduccion } from "../composicion";
import { LayoutRaiz } from "./LayoutRaiz";

/** Raíz real de la app (research R3): arma las dependencias de producción una sola vez. */
export function RaizDeLaApp() {
  const [dependencias] = useState(crearDependenciasDeProduccion);
  return <LayoutRaiz dependencias={dependencias} />;
}
