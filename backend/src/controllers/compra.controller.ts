import type { CompraVista, MisComprasDelEventoVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { CompraService } from "../services/compra.service";
import { compraNueva, comprasDelEvento } from "../validations/compra.validation";

/** HTTP de las compras: lee la entrada ya validada y llama al service (sin reglas). */
export class CompraController {
  constructor(private readonly compraService: CompraService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  crear = async (req: Request, res: Response<CompraVista>): Promise<void> => {
    const { eventoId } = compraNueva.leer(req, "params");
    const datos = compraNueva.leer(req, "body");
    res.status(201).json(await this.compraService.crear(eventoId, usuarioActual(req).id, datos));
  };

  misComprasDelEvento = async (req: Request, res: Response<MisComprasDelEventoVista>): Promise<void> => {
    const { eventoId } = comprasDelEvento.leer(req, "params");
    res.json(await this.compraService.misComprasDelEvento(eventoId, usuarioActual(req).id));
  };
}
