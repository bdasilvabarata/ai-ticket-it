import { Router } from "express";
import { listar, obtenerActual, obtenerPorId } from "../controllers/usuario.controller";
import { requerirUsuario } from "../middlewares/requerir-usuario";
import { validar } from "../middlewares/validar";
import { usuarioPorIdSchema } from "./usuarios.schemas";

export const usuariosRouter = Router();

// Público.
usuariosRouter.get("/", listar);
// Requiere usuario. Declarada antes que /:id ("actual" no es un id válido, no hay ambigüedad).
usuariosRouter.get("/actual", requerirUsuario, obtenerActual);
// Público.
usuariosRouter.get("/:id", validar(usuarioPorIdSchema), obtenerPorId);
