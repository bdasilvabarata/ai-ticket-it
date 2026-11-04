import { Types } from "mongoose";
import { EventoModel } from "./models/evento.model";

// Lo amplían 003 (crear) y 004 (explorar).
export const eventoRepository = {
  /**
   * Cantidad de eventos (pasados y futuros) por organizador, en una sola agregación.
   * Los ids sin eventos no aparecen en el Map. `aggregate()` no castea con el esquema: los
   * ids se convierten a ObjectId antes del `$match`.
   */
  async contarPorOrganizador(ids: string[]): Promise<Map<string, number>> {
    const resultado = await EventoModel.aggregate<{ _id: Types.ObjectId; cantidad: number }>([
      { $match: { organizador: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: "$organizador", cantidad: { $sum: 1 } } },
    ]);
    return new Map(resultado.map((fila) => [fila._id.toString(), fila.cantidad]));
  },
};
