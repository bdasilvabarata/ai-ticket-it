import type {
  CatalogoVista,
  EventoResumenVista,
  EventoVista,
  ReseniasDelOrganizadorVista,
} from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { EventoService } from "../services/evento.service";
import { consultaCatalogo, eventoEditado, eventoNuevo, eventoPorId } from "../validations/evento.validation";

/** HTTP de eventos: lee la entrada ya validada, llama al service y arma la respuesta. */
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  // Métodos como propiedades flecha: se pasan a las rutas sin perder `this`.
  /** Público: el catálogo de Explorar con la consulta ya validada. */
  listar = async (req: Request, res: Response<CatalogoVista>): Promise<void> => {
    res.json(await this.eventoService.listar(consultaCatalogo.leer(req, "query")));
  };

  listarMios = async (req: Request, res: Response<EventoResumenVista[]>): Promise<void> => {
    res.json(await this.eventoService.listarMios(usuarioActual(req).id));
  };

  crear = async (req: Request, res: Response<EventoVista>): Promise<void> => {
    const datos = eventoNuevo.leer(req, "body");
    res.status(201).json(await this.eventoService.crear(usuarioActual(req).id, datos));
  };

  obtener = async (req: Request, res: Response<EventoVista>): Promise<void> => {
    const { eventoId } = eventoPorId.leer(req, "params");
    res.json(await this.eventoService.obtener(eventoId));
  };

  /** Público (feature 012): el organizador del evento con su puntaje y las reseñas de sus eventos. */
  reseniasDelOrganizador = async (
    req: Request,
    res: Response<ReseniasDelOrganizadorVista>,
  ): Promise<void> => {
    const { eventoId } = eventoPorId.leer(req, "params");
    res.json(await this.eventoService.reseniasDelOrganizador(eventoId));
  };

  /** Público (feature 013, R5): el organizador con su puntaje y las 3 reseñas más recientes. */
  resumenDeResenias = async (req: Request, res: Response<ReseniasDelOrganizadorVista>): Promise<void> => {
    const { eventoId } = eventoPorId.leer(req, "params");
    res.json(await this.eventoService.resumenDeResenias(eventoId));
  };

  actualizar = async (req: Request, res: Response<EventoVista>): Promise<void> => {
    const { eventoId } = eventoEditado.leer(req, "params");
    const datos = eventoEditado.leer(req, "body");
    res.json(await this.eventoService.actualizar(eventoId, usuarioActual(req).id, datos));
  };

  eliminar = async (req: Request, res: Response): Promise<void> => {
    const { eventoId } = eventoPorId.leer(req, "params");
    await this.eventoService.eliminar(eventoId, usuarioActual(req).id);
    res.status(204).end();
  };
}
