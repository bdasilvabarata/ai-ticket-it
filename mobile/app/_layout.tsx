import { useState } from "react";

import { crearDependenciasDeProduccion } from "../src/composicion";
import { LayoutRaiz } from "../src/navegacion/LayoutRaiz";

export default function Raiz() {
  const [dependencias] = useState(crearDependenciasDeProduccion);
  return <LayoutRaiz dependencias={dependencias} />;
}
