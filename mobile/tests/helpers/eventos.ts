import type { CategoriaVista, EventoResumenVista, EventoVista, OrganizadorVista } from "@ai-ticket-it/shared";

// Datos de ejemplo de la feature 004 para los tests de mobile (con la forma de la API).

export const categorias: CategoriaVista[] = [
  { id: "categoria-conferencias", nombre: "Conferencias", descripcion: "Charlas." },
  { id: "categoria-musica", nombre: "Música", descripcion: "Recitales." },
  { id: "categoria-teatro", nombre: "Teatro", descripcion: "Obras." },
];

/** Lucía como organizadora, sin reseñas (como en el seed). */
export const luciaOrganizadora: OrganizadorVista = {
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  puntaje: null,
  cantidadResenias: 0,
};

export const nocheDeRock: EventoResumenVista = {
  id: "evento-noche-de-rock",
  nombre: "Noche de Rock en el Club",
  categoria: { id: "categoria-musica", nombre: "Música" },
  fechaHora: "2026-12-01T23:00:00.000Z",
  fechaHoraLocal: "2026-12-01T20:00",
  organizadorId: "usuario-lucia",
  realizado: false,
  cantidadTiposEntrada: 1,
};

export const festival: EventoResumenVista = {
  id: "evento-festival",
  nombre: "Festival Sonidos del Sur",
  categoria: { id: "categoria-musica", nombre: "Música" },
  fechaHora: "2026-12-10T17:00:00.000Z",
  fechaHoraLocal: "2026-12-10T14:00",
  organizadorId: "usuario-lucia",
  realizado: false,
  cantidadTiposEntrada: 3,
};

export const nocheDeRisas: EventoResumenVista = {
  id: "evento-noche-de-risas",
  nombre: "Stand-up: Noche de risas",
  categoria: { id: "categoria-teatro", nombre: "Teatro" },
  fechaHora: "2026-11-08T01:00:00.000Z",
  fechaHoraLocal: "2026-11-07T22:00",
  organizadorId: "usuario-lucia",
  realizado: true,
  cantidadTiposEntrada: 1,
};

export const hamletDeMartin: EventoResumenVista = {
  id: "evento-hamlet",
  nombre: "Hamlet, versión contemporánea",
  categoria: { id: "categoria-teatro", nombre: "Teatro" },
  fechaHora: "2026-11-20T23:00:00.000Z",
  fechaHoraLocal: "2026-11-20T20:00",
  organizadorId: "usuario-martin",
  realizado: false,
  cantidadTiposEntrada: 2,
};

/** Festival completo, con tres tipos de entrada. */
export const festivalCompleto: EventoVista = {
  ...festival,
  descripcion: "Un día entero de música.",
  multimedia: ["https://example.com/festival.jpg"],
  tiposEntrada: [
    {
      id: "tipo-festival-general",
      nombre: "General",
      descripcion: "Acceso al predio.",
      precio: 45000,
      cupo: 500,
    },
    { id: "tipo-festival-vip", nombre: "VIP", descripcion: "Con barra.", precio: 120000, cupo: 0 },
    { id: "tipo-festival-backstage", nombre: "Backstage", descripcion: "", precio: 0, cupo: 3 },
  ],
  organizador: luciaOrganizadora,
};

export const nocheDeRisasCompleta: EventoVista = {
  ...nocheDeRisas,
  descripcion: "Cuatro comediantes, una noche.",
  multimedia: ["https://example.com/risas.jpg"],
  tiposEntrada: [
    { id: "tipo-risas-general", nombre: "General", descripcion: "Libre.", precio: 12000, cupo: 80 },
  ],
  organizador: luciaOrganizadora,
};

export function errorApi(codigo: string, mensaje: string, detalles?: { campo: string; mensaje: string }[]) {
  return { error: detalles ? { codigo, mensaje, detalles } : { codigo, mensaje } };
}
