import type { Types } from "mongoose";
import type { Usuario } from "../domain/usuario";
import { UsuarioModel } from "./models/usuario.model";

interface UsuarioPersistido {
  _id: Types.ObjectId;
  nombre: string;
  apellido: string;
  favoritos: Types.ObjectId[];
}

function aDominio(documento: UsuarioPersistido): Usuario {
  return {
    id: documento._id.toString(),
    nombre: documento.nombre,
    apellido: documento.apellido,
    favoritos: documento.favoritos.map((id) => id.toString()),
  };
}

export const usuarioRepository = {
  async listar(): Promise<Usuario[]> {
    const documentos = await UsuarioModel.find().lean();
    return documentos.map(aDominio);
  },

  async buscarPorId(id: string): Promise<Usuario | null> {
    const documento = await UsuarioModel.findById(id).lean();
    return documento ? aDominio(documento) : null;
  },
};
