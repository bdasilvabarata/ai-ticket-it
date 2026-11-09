/** Vista pública de un usuario (selector de usuario de la app). */
export interface UsuarioVista {
  id: string;
  nombre: string;
  apellido: string;
  /** Cuenta todos sus eventos, pasados y futuros. */
  cantidadEventosOrganizados: number;
}
