import type { UsuarioVista } from "@ai-ticket-it/shared";

export const lucia: UsuarioVista = {
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  cantidadEventosOrganizados: 2,
};

export const martin: UsuarioVista = {
  id: "usuario-martin",
  nombre: "Martín",
  apellido: "Benítez",
  cantidadEventosOrganizados: 1,
};

export const diego: UsuarioVista = {
  id: "usuario-diego",
  nombre: "Diego",
  apellido: "Fernández",
  cantidadEventosOrganizados: 0,
};

export const todos = [lucia, martin, diego];

export const CLAVE_RECORDADO = "ai-ticket-it/usuario-recordado";
