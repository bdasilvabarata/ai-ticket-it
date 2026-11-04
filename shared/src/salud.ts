/** Dónde guarda los datos el servidor: MongoDB en memoria o una base externa (MONGO_URI). */
export type Almacenamiento = "memoria" | "externo";

/** Respuesta de `GET /api/salud`. */
export interface SaludVista {
  estado: "ok";
  almacenamiento: Almacenamiento;
}
