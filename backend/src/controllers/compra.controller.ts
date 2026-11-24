import type {
  ChatDeLaCompraVista,
  CompraDelEventoVista,
  ComprasDelEventoVista,
  CompraVista,
  MensajeVista,
  MiCompraVista,
  MisComprasDelEventoVista,
  ReseniaVista,
} from "@ai-ticket-it/shared";
import type { Request, Response } from "express";
import { usuarioActual } from "../middlewares/requerir-usuario";
import type { CompraService } from "../services/compra.service";
import {
  compraNueva,
  compraPorId,
  comprasDelEvento,
  consultaComprasDelEvento,
  mensajeNuevo,
} from "../validations/compra.validation";
import { reseniaNueva } from "../validations/resenia.validation";

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

  /**
   * `GET /eventos/:eventoId/compras` (features 008 y 013): una página de las compras del evento,
   * filtradas, para su organizador.
   */
  comprasDelEvento = async (req: Request, res: Response<ComprasDelEventoVista>): Promise<void> => {
    const { eventoId } = consultaComprasDelEvento.leer(req, "params");
    const consulta = consultaComprasDelEvento.leer(req, "query");
    res.json(await this.compraService.comprasDelEvento(eventoId, usuarioActual(req).id, consulta));
  };

  misCompras = async (req: Request, res: Response<MiCompraVista[]>): Promise<void> => {
    res.json(await this.compraService.misCompras(usuarioActual(req).id));
  };

  obtener = async (req: Request, res: Response<CompraVista>): Promise<void> => {
    const { compraId } = compraPorId.leer(req, "params");
    res.json(await this.compraService.obtener(compraId, usuarioActual(req).id));
  };

  pagar = async (req: Request, res: Response<CompraVista>): Promise<void> => {
    const { compraId } = compraPorId.leer(req, "params");
    res.json(await this.compraService.pagar(compraId, usuarioActual(req).id));
  };

  cancelar = async (req: Request, res: Response<CompraVista>): Promise<void> => {
    const { compraId } = compraPorId.leer(req, "params");
    res.json(await this.compraService.cancelar(compraId, usuarioActual(req).id));
  };

  confirmarReembolso = async (req: Request, res: Response<CompraDelEventoVista>): Promise<void> => {
    const { compraId } = compraPorId.leer(req, "params");
    res.json(await this.compraService.confirmarReembolso(compraId, usuarioActual(req).id));
  };

  /** `POST /eventos/:eventoId/resenias` (feature 012): la reseña del usuario actual a ese evento. */
  reseniar = async (req: Request, res: Response<ReseniaVista>): Promise<void> => {
    const { eventoId } = reseniaNueva.leer(req, "params");
    const datos = reseniaNueva.leer(req, "body");
    res.status(201).json(await this.compraService.reseniar(eventoId, usuarioActual(req).id, datos));
  };

  /** `GET /compras/:compraId/mensajes` (feature 011): el chat, para sus dos partes. */
  chat = async (req: Request, res: Response<ChatDeLaCompraVista>): Promise<void> => {
    const { compraId } = compraPorId.leer(req, "params");
    res.json(await this.compraService.chat(compraId, usuarioActual(req).id));
  };

  /** `POST /compras/:compraId/mensajes` (feature 011): un mensaje nuevo de una de las dos partes. */
  enviarMensaje = async (req: Request, res: Response<MensajeVista>): Promise<void> => {
    const { compraId } = mensajeNuevo.leer(req, "params");
    const datos = mensajeNuevo.leer(req, "body");
    res.status(201).json(await this.compraService.enviarMensaje(compraId, usuarioActual(req).id, datos));
  };
}
