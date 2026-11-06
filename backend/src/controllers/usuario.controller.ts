import type { UsuarioVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { UsuarioService } from "../services/usuario.service";
import { usuarioPorId } from "../validations/usuario.validation";

/** HTTP de usuarios: lee la entrada ya validada, llama al service y arma la respuesta. */
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  listar = async (_req: Request, res: Response<UsuarioVista[]>): Promise<void> => {
    res.json(await this.usuarioService.listar());
  };

  obtenerPorId = async (req: Request, res: Response<UsuarioVista>): Promise<void> => {
    const { id } = usuarioPorId.leer(req, "params");
    res.json(await this.usuarioService.obtener(id));
  };

  obtenerActual = async (req: Request, res: Response<UsuarioVista>): Promise<void> => {
    res.json(await this.usuarioService.obtener(usuarioActual(req).id));
  };
}
