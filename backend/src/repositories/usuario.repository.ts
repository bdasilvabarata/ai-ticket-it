import type { Types } from "mongoose";
import type { RepositorioUsuarios } from "../domain/repositorios";
import { Usuario } from "../domain/usuario";
import { UsuarioModel } from "./models/usuario.model";

interface UsuarioPersistido {
  _id: Types.ObjectId;
  nombre: string;
  apellido: string;
  favoritos: Types.ObjectId[];
}

/** Documento de Mongo → entidad de dominio. Mongoose no sale de esta capa (principio III). */
function aDominio(documento: UsuarioPersistido): Usuario {
  return new Usuario({
    id: documento._id.toString(),
    nombre: documento.nombre,
    apellido: documento.apellido,
    favoritos: documento.favoritos.map((id) => id.toString()),
  });
}

export class UsuarioRepository implements RepositorioUsuarios {
  constructor(private readonly modelo = UsuarioModel) {}

  async listar(): Promise<Usuario[]> {
    const documentos = await this.modelo.find().lean();
    return documentos.map(aDominio);
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const documento = await this.modelo.findById(id).lean();
    return documento ? aDominio(documento) : null;
  }
}
