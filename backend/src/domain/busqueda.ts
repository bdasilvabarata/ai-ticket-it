// Normalización de la búsqueda del catálogo (research R3), pura y sin `Intl`.
//
// Ignora mayúsculas, acentos y diéresis de las vocales, y distingue la ñ de la n: las mismas
// equivalencias que `mismoNombreDeTipo` para el español. Diferencia aceptada: el Collator `base` de
// `mismoNombreDeTipo` también ignora marcas que no son del español (`ç`, `à`); la búsqueda no, porque
// la spec pide quitar "solo las tildes y la diéresis de las vocales".

/** Acento agudo (U+0301) o diéresis (U+0308) detrás de una vocal, ya separados por NFD. */
const MARCAS_DE_VOCAL = /([aeiouAEIOU])[\u0301\u0308]+/g;

/** "BÁSQUET" → "basquet"; "Pingüino" → "pinguino"; "Año" → "año" (la virgulilla de la ñ queda). */
export function normalizarParaBuscar(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DE_VOCAL, "$1").normalize("NFC").toLowerCase();
}

/** Las palabras de lo que escribió el comprador, normalizadas: "  club   ROCK " → ["club", "rock"]. */
export function palabrasDeBusqueda(texto: string): string[] {
  return normalizarParaBuscar(texto)
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0);
}
