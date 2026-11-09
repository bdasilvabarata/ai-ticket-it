import type { Request } from "express";
import { NoEncontradoError } from "../errors/index";

/** Se monta después de todas las rutas: cualquier método + ruta que llegue acá no existe. */
export function rutaNoEncontrada(req: Request): never {
  const ruta = req.originalUrl.split("?")[0];
  throw new NoEncontradoError("RUTA_NO_ENCONTRADA", `No existe la ruta ${req.method} ${ruta}.`);
}
