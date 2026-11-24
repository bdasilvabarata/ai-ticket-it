import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { EntradaService } from "../services/entrada.service";
import { entradaPorCodigo } from "../validations/entrada.validation";

/** HTTP de las entradas de un evento (feature 008): lee la entrada ya validada y llama al service. */
export class EntradaController {
  constructor(private readonly entradaService: EntradaService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  /** `GET /eventos/:eventoId/entradas/:codigo`: la entrada, para verla antes de registrar el uso. */
  obtener = async (req: Request, res: Response<EntradaDelEventoVista>): Promise<void> => {
    const { eventoId, codigo } = entradaPorCodigo.leer(req, "params");
    res.json(await this.entradaService.obtener(eventoId, codigo, usuarioActual(req).id));
  };

  /** `POST /eventos/:eventoId/entradas/:codigo/uso`: sin cuerpo (si llega uno, se ignora). */
  registrarUso = async (req: Request, res: Response<EntradaDelEventoVista>): Promise<void> => {
    const { eventoId, codigo } = entradaPorCodigo.leer(req, "params");
    res.json(await this.entradaService.registrarUso(eventoId, codigo, usuarioActual(req).id));
  };
}
