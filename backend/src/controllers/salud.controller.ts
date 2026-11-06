import type { Almacenamiento, SaludVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";

export class SaludController {
  constructor(private readonly almacenamiento: Almacenamiento) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  obtener = (_req: Request, res: Response<SaludVista>): void => {
    res.json({ estado: "ok", almacenamiento: this.almacenamiento });
  };
}
