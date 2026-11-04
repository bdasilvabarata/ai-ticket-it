/**
 * Host y base de una URI de MongoDB, sin credenciales, para mostrar en mensajes. Puro.
 * No usa `new URL()` porque las URIs con varios hosts (`mongodb://a:1,b:2/x`) no la parsean.
 */
export function destinoMongo(uri: string): { host: string; base: string } {
  const sinEsquema = uri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const barra = sinEsquema.indexOf("/");
  const autoridad = barra === -1 ? sinEsquema : sinEsquema.slice(0, barra);
  const resto = barra === -1 ? "" : sinEsquema.slice(barra + 1);
  const host = autoridad.slice(autoridad.lastIndexOf("@") + 1);
  const base = resto.split("?")[0] ?? "";
  return { host, base };
}
