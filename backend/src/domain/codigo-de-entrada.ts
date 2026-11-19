/**
 * Código de una entrada (research R2): 8 caracteres de Crockford base 32 sin ambiguos (sin I, L,
 * O ni U). Se guarda y viaja canónico (`7K3MQ9TB`); los genera el repositorio.
 */
export const ALFABETO_DE_CODIGO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LARGO_DE_CODIGO = 8;

const FORMATO = new RegExp(`^[${ALFABETO_DE_CODIGO}]{${LARGO_DE_CODIGO}}$`);

/** Exactamente `LARGO_DE_CODIGO` caracteres del alfabeto, en forma canónica (mayúsculas, sin guiones). */
export function esCodigoValido(codigo: string): boolean {
  return FORMATO.test(codigo);
}

/** Lo que tipeó o dictó alguien, en forma canónica: mayúsculas, sin espacios ni guiones. No valida. */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/[\s-]/g, "").toUpperCase();
}
