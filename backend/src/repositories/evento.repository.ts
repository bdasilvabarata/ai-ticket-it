import { Types } from "mongoose";
import type { RepositorioEventos } from "../domain/repositorios";
import { EventoModel } from "./models/evento.model";

// Lo amplían 003 (crear) y 004 (explorar).
export class EventoRepository implements RepositorioEventos {
  constructor(private readonly modelo = EventoModel) {}

  /**
   * Cantidad de eventos (pasados y futuros) por organizador, en una sola agregación.
   * `aggregate()` no castea con el esquema: los ids se convierten a ObjectId antes del `$match`.
   */
  async contarPorOrganizador(ids: string[]): Promise<Map<string, number>> {
    const resultado = await this.modelo.aggregate<{ _id: Types.ObjectId; cantidad: number }>([
      { $match: { organizador: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: "$organizador", cantidad: { $sum: 1 } } },
    ]);
    return new Map(resultado.map((fila) => [fila._id.toString(), fila.cantidad]));
  }
}
