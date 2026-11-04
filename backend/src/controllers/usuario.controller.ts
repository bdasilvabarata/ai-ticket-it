import type { UsuarioVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import { usuarioService } from "../services/usuario.service";
import { usuarioPorId } from "./usuario.schemas";

export async function listar(_req: Request, res: Response<UsuarioVista[]>): Promise<void> {
  res.json(await usuarioService.listar());
}

export async function obtenerPorId(req: Request, res: Response<UsuarioVista>): Promise<void> {
  const { id } = usuarioPorId.leer(req, "params");
  res.json(await usuarioService.obtenerVista(id));
}

export async function obtenerActual(req: Request, res: Response<UsuarioVista>): Promise<void> {
  res.json(await usuarioService.obtenerVista(usuarioActual(req).id));
}
