import type { EventoResumenVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { EventoService } from "../services/evento.service";

/** HTTP de eventos: lee la entrada ya validada, llama al service y arma la respuesta. */
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  listarMios = async (req: Request, res: Response<EventoResumenVista[]>): Promise<void> => {
    res.json(await this.eventoService.listarMios(usuarioActual(req).id));
  };
}
