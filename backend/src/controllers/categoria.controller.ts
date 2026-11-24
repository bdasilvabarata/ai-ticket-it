import type { CategoriaVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import type { CategoriaService } from "../services/categoria.service";

/** HTTP de categorías. */
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  listar = async (_req: Request, res: Response<CategoriaVista[]>): Promise<void> => {
    res.json(await this.categoriaService.listar());
  };
}
