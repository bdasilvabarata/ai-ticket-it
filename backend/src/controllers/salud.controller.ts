import type { SaludVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";

export function obtenerSalud(req: Request, res: Response<SaludVista>): void {
  res.json({ estado: "ok", almacenamiento: req.app.locals.almacenamiento });
}
