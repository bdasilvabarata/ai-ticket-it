export interface EstadoSecuencia {
  enCurso: boolean;
  automaticosRestantes: number;
}

export interface Temporizador {
  programar(accion: () => void, ms: number): unknown;
  cancelar(id: unknown): void;
}

export interface OpcionesSecuencia {
  /** `true` = éxito (la secuencia termina). Una excepción cuenta como fallo. */
  intentar: () => Promise<boolean>;
  alCambiar: (estado: EstadoSecuencia) => void;
  temporizador?: Temporizador;
}

// Se leen los globales en cada llamada, así los temporizadores falsos de Jest los reemplazan.
const temporizadorDelSistema: Temporizador = {
  programar: (accion, ms) => setTimeout(accion, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Reintentos automáticos con espera exponencial y "Reintentar" manual (FR-021a, R7).
 * Nunca hay dos intentos a la vez. Sin React: se prueba con temporizadores falsos.
 */
export class SecuenciaDeReintentos {
  static readonly esperasMs: readonly number[] = [1000, 2000, 4000, 8000, 16000, 32000];

  readonly #intentar: () => Promise<boolean>;
  readonly #alCambiar: (estado: EstadoSecuencia) => void;
  readonly #temporizador: Temporizador;

  #activa = false;
  #enCurso = false;
  #indice = 0;
  #automaticosRestantes = SecuenciaDeReintentos.esperasMs.length;
  #pendiente: unknown = null;
  /** Cambia con `detener()`: el resultado de un intento de una generación anterior se descarta. */
  #generacion = 0;

  constructor({ intentar, alCambiar, temporizador = temporizadorDelSistema }: OpcionesSecuencia) {
    this.#intentar = intentar;
    this.#alCambiar = alCambiar;
    this.#temporizador = temporizador;
  }

  get enCurso(): boolean {
    return this.#enCurso;
  }

  get automaticosRestantes(): number {
    return this.#automaticosRestantes;
  }

  /** Programa el primer reintento automático. Si ya está corriendo, no hace nada. */
  iniciar(): void {
    if (this.#activa) return;
    this.#activa = true;
    this.#reiniciarConteo();
    this.#programar();
    this.#avisar();
  }

  /** Intenta en el acto; si falla, reinicia la secuencia desde la primera espera. */
  async reintentarAhora(): Promise<void> {
    if (this.#enCurso) return;
    this.#cancelarPendiente();
    this.#activa = true;
    await this.#ejecutar(true);
  }

  detener(): void {
    this.#generacion += 1;
    this.#cancelarPendiente();
    this.#activa = false;
    this.#enCurso = false;
    this.#reiniciarConteo();
    this.#avisar();
  }

  #reiniciarConteo(): void {
    this.#indice = 0;
    this.#automaticosRestantes = SecuenciaDeReintentos.esperasMs.length;
  }

  #programar(): void {
    const espera = SecuenciaDeReintentos.esperasMs[this.#indice];
    this.#pendiente = this.#temporizador.programar(() => {
      this.#pendiente = null;
      this.#automaticosRestantes -= 1;
      void this.#ejecutar(false);
    }, espera);
  }

  #cancelarPendiente(): void {
    if (this.#pendiente === null) return;
    this.#temporizador.cancelar(this.#pendiente);
    this.#pendiente = null;
  }

  async #ejecutar(manual: boolean): Promise<void> {
    const generacion = this.#generacion;
    this.#enCurso = true;
    this.#avisar();

    let exito: boolean;
    try {
      exito = await this.#intentar();
    } catch {
      exito = false;
    }
    if (generacion !== this.#generacion) return;

    this.#enCurso = false;
    if (exito) {
      this.#activa = false;
      this.#reiniciarConteo();
    } else if (manual) {
      this.#reiniciarConteo();
      this.#programar();
    } else {
      this.#indice += 1;
      if (this.#indice < SecuenciaDeReintentos.esperasMs.length) this.#programar();
    }
    this.#avisar();
  }

  #avisar(): void {
    this.#alCambiar({ enCurso: this.#enCurso, automaticosRestantes: this.#automaticosRestantes });
  }
}
