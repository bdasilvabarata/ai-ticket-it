import type {
  RepositorioCategorias,
  RepositorioCompras,
  RepositorioEventos,
  RepositorioResenias,
  RepositorioUsuarios,
} from "../domain/repositorios";
import { CategoriaRepository } from "../repositories/categoria.repository";
import { CompraRepository } from "../repositories/compra.repository";
import { EventoRepository } from "../repositories/evento.repository";
import { ReseniaRepository } from "../repositories/resenia.repository";
import { UsuarioRepository } from "../repositories/usuario.repository";
import { crearDatosEjemplo } from "./datos-ejemplo";

export interface Repositorios {
  usuarios: RepositorioUsuarios;
  categorias: RepositorioCategorias;
  eventos: RepositorioEventos;
  compras: RepositorioCompras;
  resenias: RepositorioResenias;
}

/**
 * Repositorios en memoria **nuevos** cargados con los datos de ejemplo (FR-005). Cada llamada
 * crea su propio estado: el servidor arranca con una y cada test puede pedir la suya.
 */
export function crearRepositoriosDeEjemplo(ahora: Date = new Date()): Repositorios {
  const { usuarios, categorias, eventos, compras, resenias } = crearDatosEjemplo(ahora);
  return {
    usuarios: new UsuarioRepository(usuarios),
    categorias: new CategoriaRepository(categorias),
    eventos: new EventoRepository(eventos),
    compras: new CompraRepository(compras),
    // Feature 012 (R10): Martín y Sofía con reseñas; Lucía, sin puntaje.
    resenias: new ReseniaRepository(resenias),
  };
}
