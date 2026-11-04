import { model, Schema } from "mongoose";

const entero = {
  validator: (valor: number) => Number.isInteger(valor),
  message: "{PATH} debe ser un número entero.",
};

/** Subdocumento embebido: cada tipo de entrada tiene `_id` propio para que lo referencien las compras. */
const tipoEntradaSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, default: "" },
  /** Pesos argentinos enteros. */
  precio: { type: Number, required: true, min: 0, validate: entero },
  /** Entradas disponibles: decrece con cada compra y nunca baja de 0. */
  cupo: { type: Number, required: true, min: 0, validate: entero },
});

const eventoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true },
    categoria: { type: Schema.Types.ObjectId, ref: "Categoria", required: true },
    fechaHora: { type: Date, required: true },
    multimedia: { type: [String], default: [] },
    organizador: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    tiposEntrada: {
      type: [tipoEntradaSchema],
      validate: {
        validator: (tipos: unknown[]) => tipos.length >= 1,
        message: "El evento necesita al menos un tipo de entrada.",
      },
    },
  },
  { collection: "eventos", versionKey: false },
);

eventoSchema.index({ organizador: 1 });
eventoSchema.index({ categoria: 1 });

export const EventoModel = model("Evento", eventoSchema);
