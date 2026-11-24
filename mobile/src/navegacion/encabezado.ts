import { tema } from "../componentes";

/** Estilo común de los encabezados de navegación (pestañas y pantallas apiladas). */
export const opcionesDeEncabezado = {
  headerStyle: { backgroundColor: tema.colores.fondo },
  headerTitleStyle: { ...tema.tipografia.encabezado, color: tema.colores.texto },
  headerTintColor: tema.colores.texto,
  headerShadowVisible: false,
} as const;
