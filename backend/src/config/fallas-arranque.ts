/** Falla de arranque con un mensaje ya pensado para el usuario. No es un error HTTP. */
export class ErrorArranque extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "ErrorArranque";
  }
}

function tieneCodigo(error: unknown, codigo: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === codigo;
}

/** Traduce una falla de arranque a un mensaje en español (FR-011). Puro. */
export function mensajeFallaArranque(error: unknown, puerto: number): string {
  if (error instanceof ErrorArranque) return error.message;
  if (tieneCodigo(error, "EADDRINUSE")) {
    return `El puerto ${puerto} ya está en uso. Cerrá el otro proceso o cambiá PORT en backend/.env.`;
  }
  if (error instanceof Error) return `No se pudo arrancar el servidor: ${error.message}`;
  return `No se pudo arrancar el servidor: ${String(error)}`;
}
