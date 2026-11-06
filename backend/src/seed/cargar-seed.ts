import { Types } from "mongoose";
import { CategoriaModel } from "../repositories/models/categoria.model";
import { EventoModel } from "../repositories/models/evento.model";
import { UsuarioModel } from "../repositories/models/usuario.model";
import { crearDatosEjemplo } from "./datos-ejemplo";

export interface ResumenSeed {
  categorias: number;
  usuarios: number;
  eventos: number;
}

const oid = (id: string) => new Types.ObjectId(id);

/**
 * Vacía `categorias`, `usuarios` y `eventos` y carga los datos de ejemplo. Destructivo e
 * idempotente: lo que no es parte de los datos de ejemplo desaparece.
 */
export async function cargarSeed(ahora: Date = new Date()): Promise<ResumenSeed> {
  const { categorias, usuarios, eventos } = crearDatosEjemplo(ahora);

  await Promise.all([UsuarioModel.deleteMany({}), CategoriaModel.deleteMany({}), EventoModel.deleteMany({})]);

  await CategoriaModel.insertMany(
    categorias.map((categoria) => ({
      _id: oid(categoria.id),
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
    })),
  );
  await UsuarioModel.insertMany(
    usuarios.map((usuario) => ({
      _id: oid(usuario.id),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      favoritos: usuario.favoritos.map(oid),
    })),
  );
  await EventoModel.insertMany(
    eventos.map((evento) => ({
      _id: oid(evento.id),
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      categoria: oid(evento.categoriaId),
      fechaHora: evento.fechaHora,
      multimedia: [...evento.multimedia],
      organizador: oid(evento.organizadorId),
      tiposEntrada: evento.tiposEntrada.map((tipo) => ({
        _id: oid(tipo.id),
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        precio: tipo.precio,
        cupo: tipo.cupo,
      })),
    })),
  );

  return { categorias: categorias.length, usuarios: usuarios.length, eventos: eventos.length };
}
