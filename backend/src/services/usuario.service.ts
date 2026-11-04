import type { UsuarioVista } from "@ai-ticket-it/shared";
import { compararPorApellidoYNombre, type Usuario } from "../domain/usuario";
import { NoEncontradoError } from "../errors/index";
import { eventoRepository } from "../repositories/evento.repository";
import { usuarioRepository } from "../repositories/usuario.repository";

function aVista(usuario: Usuario, cantidadEventosOrganizados: number): UsuarioVista {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    cantidadEventosOrganizados,
  };
}

// Objeto (y no funciones sueltas) para que los tests puedan espiarlo.
export const usuarioService = {
  async listar(): Promise<UsuarioVista[]> {
    const usuarios = await usuarioRepository.listar();
    const cantidades = await eventoRepository.contarPorOrganizador(usuarios.map((u) => u.id));
    return usuarios
      .toSorted(compararPorApellidoYNombre)
      .map((usuario) => aVista(usuario, cantidades.get(usuario.id) ?? 0));
  },

  async obtenerVista(id: string): Promise<UsuarioVista> {
    const usuario = await usuarioRepository.buscarPorId(id);
    if (!usuario) throw new NoEncontradoError("USUARIO_NO_ENCONTRADO", "No existe el usuario.");
    const cantidades = await eventoRepository.contarPorOrganizador([id]);
    return aVista(usuario, cantidades.get(id) ?? 0);
  },

  buscarPorId(id: string): Promise<Usuario | null> {
    return usuarioRepository.buscarPorId(id);
  },
};
