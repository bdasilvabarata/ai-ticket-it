/** Exclusión mutua por clave (research R1 y R2). */
export interface Cerrojo {
  /** Corre `operacion` cuando terminan las anteriores sobre la misma `clave`, y devuelve su resultado. */
  ejecutar<T>(clave: string, operacion: () => Promise<T>): Promise<T>;
}

/**
 * Cola de promesas por clave (constitución, "Operaciones atómicas por evento"): las operaciones
 * sobre una misma clave (el id de un evento) corren de a una y en orden de llegada; las de claves
 * distintas no se esperan.
 *
 * Reglas de uso:
 * 1. Dentro del cerrojo, la operación **vuelve a leer** lo que verifica (no reutiliza lecturas
 *    anteriores), verifica existencia, permiso y reglas, y recién entonces guarda.
 * 2. Se libera **siempre**, también si la operación lanza (`finally`); el error llega al que llamó.
 * 3. **Sin cerrojos anidados**: una operación bajo el cerrojo nunca pide otro.
 * 4. Las lecturas no lo usan: las entidades son inmutables y `guardar` reemplaza la referencia.
 *
 * Hay una sola instancia por app (la crea `app.ts`) y la comparten los services que modifican eventos.
 */
export class CerrojoPorClave implements Cerrojo {
  /** Última operación encolada de cada clave; se borra cuando la cola queda vacía. */
  readonly #colas = new Map<string, Promise<void>>();

  /** Cantidad de claves con operaciones en curso o en espera. */
  get clavesActivas(): number {
    return this.#colas.size;
  }

  async ejecutar<T>(clave: string, operacion: () => Promise<T>): Promise<T> {
    const anterior = this.#colas.get(clave) ?? Promise.resolve();
    let liberar = () => {};
    const actual = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const cola = anterior.then(() => actual);
    this.#colas.set(clave, cola);

    await anterior;
    try {
      return await operacion();
    } finally {
      liberar();
      if (this.#colas.get(clave) === cola) this.#colas.delete(clave);
    }
  }
}
