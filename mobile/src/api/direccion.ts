/** Puerto por defecto del servidor (feature 001). */
const PUERTO_SERVIDOR = 3000;

export interface EntradaUrlBase {
  /** `EXPO_PUBLIC_API_URL`: dirección base con `/api`. Tiene prioridad. */
  urlEntorno?: string;
  /** `Constants.expoConfig?.hostUri`, por ejemplo `"192.168.0.23:8081"`. */
  hostUri?: string | null;
}

/** Dirección base del servidor (R10): variable de entorno → host de Expo → localhost. */
export function resolverUrlBase({ urlEntorno, hostUri }: EntradaUrlBase): string {
  const entorno = urlEntorno?.trim();
  if (entorno) return entorno.replace(/\/+$/, "");

  const host = hostUri?.split("/")[0].replace(/:\d+$/, "");
  return `http://${host || "localhost"}:${PUERTO_SERVIDOR}/api`;
}
