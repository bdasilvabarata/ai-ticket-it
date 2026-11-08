import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Usuario } from "../domain/usuario";
import { UsuarioNoIdentificadoError } from "../errors/index";
import { esIdValido } from "../validations/comunes";

/** Lo único que el middleware necesita: buscar un usuario por id. */
export interface BuscadorDeUsuarios {
  buscarPorId(id: string): Promise<Usuario | null>;
}

/**
 * Identificación simulada (principio VI): exige un `X-Usuario-Id` que corresponda a un
 * usuario existente y lo deja en `req.usuario`. Las rutas públicas no lo usan.
 */
export function crearRequerirUsuario(usuarios: BuscadorDeUsuarios): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const id = req.get("X-Usuario-Id")?.trim() ?? "";
    if (!esIdValido(id)) throw new UsuarioNoIdentificadoError();
    const usuario = await usuarios.buscarPorId(id);
    if (!usuario) throw new UsuarioNoIdentificadoError();
    req.usuario = usuario;
    next();
  };
}

/** Usuario que dejó `requerirUsuario`; si falta, la ruta no lo declaró → 401. */
export function usuarioActual(req: Request): Usuario {
  if (!req.usuario) throw new UsuarioNoIdentificadoError();
  return req.usuario;
}
