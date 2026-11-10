/**
 * Única referencia de "ahora" del servidor (FR-010a, research R3). Los services lo reciben por
 * constructor y pasan `ahora()` a las operaciones de dominio; los tests usan un reloj fijo.
 */
export interface Reloj {
  ahora(): Date;
}
