import type { UsuarioVista } from "@ai-ticket-it/shared";
import type { RepositorioEventos, RepositorioUsuarios } from "../domain/repositorios";
import { compararPorApellidoYNombre, type Usuario } from "../domain/usuario";
import { NoEncontradoError } from "../errors/index";
import type { Cerrojo } from "./cerrojo-por-clave";

function aVista(usuario: Usuario, cantidadEventosOrganizados: number): UsuarioVista {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    cantidadEventosOrganizados,
  };
}

/** Casos de uso de usuarios. Recibe sus repositorios por constructor (principio III). */
export class UsuarioService {
  readonly #usuarios: RepositorioUsuarios;
  readonly #eventos: RepositorioEventos;
  readonly #cerrojo: Cerrojo;

  /**
   * `cerrojo` es la **misma** instancia que comparten los services de eventos (una por app,
   * feature 014, research R4): las escrituras de un usuario usan la clave `usuario:<id>`.
   */
  constructor({
    usuarios,
    eventos,
    cerrojo,
  }: {
    usuarios: RepositorioUsuarios;
    eventos: RepositorioEventos;
    cerrojo: Cerrojo;
  }) {
    this.#usuarios = usuarios;
    this.#eventos = eventos;
    this.#cerrojo = cerrojo;
  }

  async listar(): Promise<UsuarioVista[]> {
    const usuarios = await this.#usuarios.listar();
    const cantidades = await this.#eventos.contarPorOrganizador(usuarios.map((u) => u.id));
    return usuarios
      .toSorted(compararPorApellidoYNombre)
      .map((usuario) => aVista(usuario, cantidades.get(usuario.id) ?? 0));
  }

  /** Vista del usuario; 404 si no existe. */
  async obtener(id: string): Promise<UsuarioVista> {
    const usuario = await this.obtenerOFallar(id);
    const cantidades = await this.#eventos.contarPorOrganizador([id]);
    return aVista(usuario, cantidades.get(id) ?? 0);
  }

  /** La entidad o `null`, sin lanzar: lo usa la identificación de usuario (401, no 404). */
  buscarPorId(id: string): Promise<Usuario | null> {
    return this.#usuarios.buscarPorId(id);
  }

  /**
   * Búsqueda en lote (sin N+1): los usuarios de esos ids en una sola lectura, por id. Todos tienen
   * que existir: si falta alguno, 404 como `obtenerOFallar`.
   */
  async obtenerPorIds(ids: readonly string[]): Promise<Map<string, Usuario>> {
    const usuarios = new Map((await this.#usuarios.listarPorIds(ids)).map((u) => [u.id, u]));
    if (ids.some((id) => !usuarios.has(id))) {
      throw new NoEncontradoError("USUARIO_NO_ENCONTRADO", "No existe el usuario.");
    }
    return usuarios;
  }

  /** Único lugar que busca un usuario por id y lanza 404 si no existe. Lo usa `EventoService`. */
  async obtenerOFallar(id: string): Promise<Usuario> {
    const usuario = await this.#usuarios.buscarPorId(id);
    if (!usuario) throw new NoEncontradoError("USUARIO_NO_ENCONTRADO", "No existe el usuario.");
    return usuario;
  }

  /**
   * Marca el evento como favorito del usuario (idempotente). No sabe si el evento existe: lo
   * verifica `EventoService` antes de llamar (feature 014, research R3).
   */
  async marcarFavorito(usuarioId: string, eventoId: string): Promise<void> {
    await this.#cambiarUsuario(usuarioId, (usuario) => usuario.marcarFavorito(eventoId));
  }

  /** Desmarca el evento de los favoritos del usuario (idempotente). */
  async desmarcarFavorito(usuarioId: string, eventoId: string): Promise<void> {
    await this.#cambiarUsuario(usuarioId, (usuario) => usuario.desmarcarFavorito(eventoId));
  }

  /**
   * Leer-modificar-guardar bajo el cerrojo del usuario: relee adentro, aplica el cambio y guarda
   * solo si devolvió otro objeto (un cambio que no cambia nada no guarda).
   */
  async #cambiarUsuario(usuarioId: string, cambio: (usuario: Usuario) => Usuario): Promise<void> {
    await this.#cerrojo.ejecutar(this.#claveDe(usuarioId), async () => {
      const usuario = await this.obtenerOFallar(usuarioId);
      const cambiado = cambio(usuario);
      if (cambiado !== usuario) await this.#usuarios.guardar(cambiado);
    });
  }

  /** Clave del cerrojo compartido: los ids de eventos nunca empiezan con `usuario:` (research R4). */
  #claveDe(usuarioId: string): string {
    return `usuario:${usuarioId}`;
  }
}
