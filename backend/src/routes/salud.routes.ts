import { Router } from "express";
import { obtenerSalud } from "../controllers/salud.controller";

export const saludRouter = Router();

// Público.
saludRouter.get("/", obtenerSalud);
