import type { UsuarioVista } from "@ai-ticket-it/shared";

/** Textos de vista de un usuario, sin React (FR-015, research R9). */
export function nombreCompleto({ nombre, apellido }: Pick<UsuarioVista, "nombre" | "apellido">): string {
  return `${nombre} ${apellido}`;
}

export function textoEventosOrganizados(cantidad: number): string {
  if (cantidad === 0) return "No organiza eventos";
  return cantidad === 1 ? "Organiza 1 evento" : `Organiza ${cantidad} eventos`;
}
