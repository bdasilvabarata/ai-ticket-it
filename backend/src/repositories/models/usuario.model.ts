import { model, Schema } from "mongoose";

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    favoritos: { type: [{ type: Schema.Types.ObjectId, ref: "Evento" }], default: [] },
  },
  { collection: "usuarios", versionKey: false },
);

export const UsuarioModel = model("Usuario", usuarioSchema);
