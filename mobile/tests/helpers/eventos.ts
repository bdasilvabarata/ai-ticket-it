import type {
  CatalogoVista,
  CategoriaVista,
  EventoCatalogoVista,
  EventoResumenVista,
  EventoVista,
  OrganizadorVista,
} from "@ai-ticket-it/shared";

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

/** Sofía como organizadora, sin reseñas. */
export const sofiaOrganizadora: OrganizadorVista = {
  id: "usuario-sofia",
  nombre: "Sofía",
  apellido: "Castro",
  puntaje: null,
  cantidadResenias: 0,
};

/** Tarjetas del catálogo (feature 005), en el orden por fecha del seed. */
export const rockEnCatalogo: EventoCatalogoVista = {
  ...nocheDeRock,
  precioDesde: 15000,
  agotado: false,
  organizador: { ...luciaOrganizadora, puntaje: 4.5, cantidadResenias: 12 },
};

export const clasicoEnCatalogo: EventoCatalogoVista = {
  id: "evento-clasico-de-basquet",
  nombre: "Clásico de básquet",
  categoria: { id: "categoria-deportes", nombre: "Deportes" },
  fechaHora: "2026-11-15T22:00:00.000Z",
  fechaHoraLocal: "2026-11-15T19:00",
  organizadorId: "usuario-sofia",
  realizado: false,
  cantidadTiposEntrada: 2,
  precioDesde: 8000,
  agotado: false,
  organizador: sofiaOrganizadora,
};

export const hamletEnCatalogo: EventoCatalogoVista = {
  ...hamletDeMartin,
  precioDesde: 18000,
  agotado: true,
  organizador: {
    id: "usuario-martin",
    nombre: "Martín",
    apellido: "Benítez",
    puntaje: null,
    cantidadResenias: 0,
  },
};

export const maratonEnCatalogo: EventoCatalogoVista = {
  id: "evento-maraton-10k",
  nombre: "Maratón Ciudad 10K",
  categoria: { id: "categoria-deportes", nombre: "Deportes" },
  fechaHora: "2026-12-25T11:00:00.000Z",
  fechaHoraLocal: "2026-12-25T08:00",
  organizadorId: "usuario-lucia",
  realizado: false,
  cantidadTiposEntrada: 2,
  precioDesde: 0,
  agotado: false,
  organizador: luciaOrganizadora,
};

export function catalogo(
  eventos: EventoCatalogoVista[],
  hayEventosProximos = eventos.length > 0,
): CatalogoVista {
  return { eventos, hayEventosProximos };
}

/** La consulta inicial de Explorar (sin texto, "Todas", por fecha). */
export const CATALOGO_INICIAL = "/eventos?orden=fecha";
