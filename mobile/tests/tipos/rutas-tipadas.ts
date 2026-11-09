/**
 * Guarda de las rutas tipadas (FR-009, research R5). No es un test de Jest: lo compila `tsc` en
 * `npm run typecheck`. Si las rutas tipadas se desactivan o sus tipos no se generan, la directiva
 * de abajo queda sin uso y el typecheck falla.
 */
import type { Href } from "expo-router";

export const valida: Href = "/seleccionar-usuario";

// @ts-expect-error la ruta no existe: las rutas tipadas deben rechazarla (FR-009)
export const invalida: Href = "/seleccionar-usuarios";
