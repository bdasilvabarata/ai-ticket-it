import type { TipoEntradaVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { TipoEntradaService } from "../services/tipo-entrada.service";
import {
  tipoEntradaEditado,
  tipoEntradaNuevo,
  tipoEntradaPorId,
} from "../validations/tipo-entrada.validation";

/** HTTP de los tipos de entrada de un evento: lee la entrada ya validada y llama al service. */
export class TipoEntradaController {
  constructor(private readonly tipoEntradaService: TipoEntradaService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  crear = async (req: Request, res: Response<TipoEntradaVista>): Promise<void> => {
    const { eventoId } = tipoEntradaNuevo.leer(req, "params");
    const datos = tipoEntradaNuevo.leer(req, "body");
    res.status(201).json(await this.tipoEntradaService.crear(eventoId, usuarioActual(req).id, datos));
  };

  actualizar = async (req: Request, res: Response<TipoEntradaVista>): Promise<void> => {
    const { eventoId, tipoEntradaId } = tipoEntradaEditado.leer(req, "params");
    const datos = tipoEntradaEditado.leer(req, "body");
    res.json(await this.tipoEntradaService.actualizar(eventoId, tipoEntradaId, usuarioActual(req).id, datos));
  };

  eliminar = async (req: Request, res: Response): Promise<void> => {
    const { eventoId, tipoEntradaId } = tipoEntradaPorId.leer(req, "params");
    await this.tipoEntradaService.eliminar(eventoId, tipoEntradaId, usuarioActual(req).id);
    res.status(204).end();
  };
}
