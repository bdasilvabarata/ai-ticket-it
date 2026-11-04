import { model, Schema } from "mongoose";

const categoriaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    descripcion: { type: String, required: true },
  },
  { collection: "categorias", versionKey: false },
);

export const CategoriaModel = model("Categoria", categoriaSchema);
