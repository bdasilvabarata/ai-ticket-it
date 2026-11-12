import { normalizarParaBuscar } from "./busqueda";
import { ReglaDeNegocioError } from "./errores";
import { esEnteroNoNegativo, esTextoConContenido, Invariantes } from "./invariantes";

// En `es`, con sensitivity "base", "Platea" = " PLATEA " = "Plátea", pero "Año" ≠ "Ano" (R14).
const comparadorDeNombres = new Intl.Collator("es", { sensitivity: "base" });

/** ¿Dos nombres de tipo de entrada son "el mismo"? Sin distinguir mayúsculas, tildes ni espacios de los extremos. */
export function mismoNombreDeTipo(a: string, b: string): boolean {
  return comparadorDeNombres.compare(a.trim(), b.trim()) === 0;
}

/** "Futura" = `fechaHora > ahora`: el complemento exacto de "realizado" (research R3). */
function exigirFechaFutura(fechaHora: Date, ahora: Date): void {
  if (!(fechaHora.getTime() > ahora.getTime())) {
    throw new ReglaDeNegocioError("FECHA_NO_FUTURA", "La fecha y hora del evento deben ser futuras.");
  }
}

/** "Quedan 3 entradas de «VIP»." · "Queda 1 entrada de «VIP»." · "No quedan entradas de «VIP»." */
function mensajeDeCupo(tipo: TipoEntrada): string {
  if (tipo.cupo === 0) return `No quedan entradas de «${tipo.nombre}».`;
  if (tipo.cupo === 1) return `Queda 1 entrada de «${tipo.nombre}».`;
  return `Quedan ${tipo.cupo} entradas de «${tipo.nombre}».`;
}

function hayNombresRepetidos(tipos: readonly TipoEntrada[]): boolean {
  return tipos.some((tipo, i) =>
    tipos.slice(i + 1).some((otro) => mismoNombreDeTipo(tipo.nombre, otro.nombre)),
  );
}

export interface PropiedadesTipoEntrada {
  id: string;
  nombre: string;
  descripcion: string;
  /** Pesos argentinos enteros, ≥ 0. */
  precio: number;
  /** Entradas disponibles: entero ≥ 0 que decrece con cada compra (constitución, "Cupo"). */
  cupo: number;
}

/** Tipo de entrada de un evento (General, Platea, VIP…), con su precio y cupo disponible. */
export class TipoEntrada {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly precio: number;
  readonly cupo: number;

  constructor({ id, nombre, descripcion, precio, cupo }: PropiedadesTipoEntrada) {
    new Invariantes()
      .exigir(esTextoConContenido(nombre), "nombre", "Es obligatorio.")
      .exigir(esEnteroNoNegativo(precio), "precio", "Debe ser un entero mayor o igual a 0.")
      .exigir(esEnteroNoNegativo(cupo), "cupo", "Debe ser un entero mayor o igual a 0.")
      .verificar();
    this.id = id;
    this.nombre = nombre.trim();
    this.descripcion = descripcion;
    this.precio = precio;
    this.cupo = cupo;
  }

  /** ¿Se pueden comprar `cantidad` entradas sin dejar el cupo por debajo de 0? (diagrama de la consigna) */
  hayCupoPara(cantidad: number): boolean {
    return Number.isInteger(cantidad) && cantidad > 0 && cantidad <= this.cupo;
  }

  /** Precio 0: tiene su propio tope por persona (1 por tipo, aparte de las 4 pagas). */
  esGratis(): boolean {
    return this.precio === 0;
  }

  /** Un tipo nuevo con `cantidad` entradas menos de cupo (una compra); el constructor exige cupo ≥ 0. */
  descontar(cantidad: number): TipoEntrada {
    return this.con({
      nombre: this.nombre,
      descripcion: this.descripcion,
      precio: this.precio,
      cupo: this.cupo - cantidad,
    });
  }

  /** Un tipo nuevo con `cantidad` entradas más de cupo (las de una compra vencida); este no cambia. */
  devolver(cantidad: number): TipoEntrada {
    return this.con({
      nombre: this.nombre,
      descripcion: this.descripcion,
      precio: this.precio,
      cupo: this.cupo + cantidad,
    });
  }

  /** Un tipo nuevo con los datos editados y el mismo `id`; este no cambia. */
  con(datos: DatosDeTipoEntrada): TipoEntrada {
    return new TipoEntrada({ ...datos, id: this.id });
  }
}

/** Datos editables de un tipo de entrada (todo menos el id). */
export type DatosDeTipoEntrada = Omit<PropiedadesTipoEntrada, "id">;

export interface PropiedadesEvento {
  id: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  /** Instante UTC. */
  fechaHora: Date;
  /** URLs de imágenes. */
  multimedia: string[];
  organizadorId: string;
  tiposEntrada: TipoEntrada[];
}

/** Datos editables de un evento: lo que reemplaza `actualizar` (ni id, ni organizador, ni tipos). */
export type DatosDeEvento = Omit<PropiedadesEvento, "id" | "organizadorId" | "tiposEntrada">;

/** Evento publicado por un organizador, con uno o más tipos de entrada. */
export class Evento {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly categoriaId: string;
  readonly fechaHora: Date;
  readonly multimedia: readonly string[];
  readonly organizadorId: string;
  readonly tiposEntrada: readonly TipoEntrada[];

  constructor(datos: PropiedadesEvento) {
    new Invariantes()
      .exigir(esTextoConContenido(datos.nombre), "nombre", "Es obligatorio.")
      .exigir(!Number.isNaN(datos.fechaHora.getTime()), "fechaHora", "Debe ser una fecha válida.")
      .exigir(
        datos.tiposEntrada.length > 0,
        "tiposEntrada",
        "El evento necesita al menos un tipo de entrada.",
      )
      .verificar();
    if (hayNombresRepetidos(datos.tiposEntrada)) {
      throw new ReglaDeNegocioError(
        "NOMBRE_TIPO_ENTRADA_REPETIDO",
        "Ya hay un tipo de entrada con ese nombre en el evento.",
      );
    }
    this.id = datos.id;
    this.nombre = datos.nombre.trim();
    this.descripcion = datos.descripcion;
    this.categoriaId = datos.categoriaId;
    this.fechaHora = datos.fechaHora;
    this.multimedia = [...datos.multimedia];
    this.organizadorId = datos.organizadorId;
    this.tiposEntrada = [...datos.tiposEntrada];
  }

  /**
   * Fábrica de alta: la fecha tiene que ser futura según `ahora` (el reloj del servidor). Después
   * construye, y el constructor verifica las invariantes.
   */
  static crear(propiedades: PropiedadesEvento, ahora: Date): Evento {
    exigirFechaFutura(propiedades.fechaHora, ahora);
    return new Evento(propiedades);
  }

  /** Realizado desde el instante de inicio, inclusive (`ahora ≥ fechaHora`; research R3). */
  estaRealizado(ahora: Date): boolean {
    return ahora.getTime() >= this.fechaHora.getTime();
  }

  /** El menor precio entre **todos** los tipos, con o sin cupo (FR-004). 0 = gratis. */
  precioDesde(): number {
    // Siempre hay al menos un tipo (invariante del constructor).
    return Math.min(...this.tiposEntrada.map((tipo) => tipo.precio));
  }

  /** Todos los tipos sin cupo (FR-005). Un agotado parcial no cuenta. */
  estaAgotado(): boolean {
    return this.tiposEntrada.every((tipo) => tipo.cupo === 0);
  }

  /**
   * ¿Cada palabra (ya normalizada con `palabrasDeBusqueda`) está en el nombre **o** en la
   * descripción? Sin palabras, sí (FR-011, R4). Coincidencia literal (`includes`), sin expresiones
   * regulares armadas con la entrada; nombre y descripción se comparan por separado.
   */
  coincideCon(palabras: readonly string[]): boolean {
    const nombre = normalizarParaBuscar(this.nombre);
    const descripcion = normalizarParaBuscar(this.descripcion);
    return palabras.every((palabra) => nombre.includes(palabra) || descripcion.includes(palabra));
  }

  esOrganizadoPor(usuarioId: string): boolean {
    return this.organizadorId === usuarioId;
  }

  buscarTipoEntrada(tipoId: string): TipoEntrada | null {
    return this.tiposEntrada.find((tipo) => tipo.id === tipoId) ?? null;
  }

  // Operaciones (research R7): verifican sus reglas y devuelven un Evento **nuevo**, construido con
  // el constructor para volver a verificar las invariantes; `this` no cambia. `ahora` lo pasa el
  // service, que lo lee del reloj dentro del cerrojo del evento.

  /** Reemplaza los datos del evento; conserva id, organizador y tipos. */
  actualizar(datos: DatosDeEvento, ahora: Date): Evento {
    this.#exigirNoRealizado(ahora);
    exigirFechaFutura(datos.fechaHora, ahora);
    return this.#con(datos);
  }

  /** Agrega un tipo al final; al crearlo el cupo es ≥ 1 (un tipo agotado solo se llega a tener). */
  agregarTipoEntrada(tipo: TipoEntrada, ahora: Date): Evento {
    this.#exigirNoRealizado(ahora);
    new Invariantes().exigir(tipo.cupo >= 1, "cupo", "Debe ser un entero mayor o igual a 1.").verificar();
    return this.#con({ tiposEntrada: [...this.tiposEntrada, tipo] });
  }

  /** Edita un tipo en su lugar; el nombre se compara contra los **otros** tipos (constructor). */
  editarTipoEntrada(tipoId: string, datos: DatosDeTipoEntrada, ahora: Date): Evento {
    this.#exigirNoRealizado(ahora);
    const editado = this.#tipoOFallar(tipoId).con(datos);
    return this.#con({
      tiposEntrada: this.tiposEntrada.map((tipo) => (tipo.id === tipoId ? editado : tipo)),
    });
  }

  /** Quita un tipo: no realizado, no el último y sin compras (en ese orden; R5). */
  quitarTipoEntrada(tipoId: string, { ahora, tieneCompras }: { ahora: Date; tieneCompras: boolean }): Evento {
    this.#exigirNoRealizado(ahora);
    this.#tipoOFallar(tipoId);
    if (this.tiposEntrada.length === 1) {
      throw new ReglaDeNegocioError(
        "ULTIMO_TIPO_ENTRADA",
        "El evento debe conservar al menos un tipo de entrada.",
      );
    }
    if (tieneCompras) {
      throw new ReglaDeNegocioError(
        "TIPO_ENTRADA_CON_COMPRAS",
        "El tipo de entrada tiene compras: no se puede quitar.",
      );
    }
    return this.#con({ tiposEntrada: this.tiposEntrada.filter((tipo) => tipo.id !== tipoId) });
  }

  /** Un evento se elimina si no se realizó y no tiene compras (en ningún estado). No devuelve nada. */
  verificarQueSePuedeEliminar({ ahora, tieneCompras }: { ahora: Date; tieneCompras: boolean }): void {
    this.#exigirNoRealizado(ahora);
    if (tieneCompras) {
      throw new ReglaDeNegocioError("EVENTO_CON_COMPRAS", "El evento tiene compras: no se puede eliminar.");
    }
  }

  /** Las reglas de una compra que dependen solo del evento, en el orden de R2: realizado → propio evento. */
  exigirQueSePuedeComprar(compradorId: string, ahora: Date): void {
    this.#exigirNoRealizadoParaComprar(ahora);
    if (this.esOrganizadoPor(compradorId)) {
      throw new ReglaDeNegocioError(
        "COMPRA_PROPIO_EVENTO",
        "No podés comprar entradas de un evento que organizás.",
      );
    }
  }

  /**
   * Descuenta `cantidad` entradas del tipo (una compra): no realizado → tipo (red de seguridad) →
   * cupo suficiente (`CUPO_INSUFICIENTE` dice cuántas quedan). Devuelve un Evento nuevo.
   */
  descontarCupo(tipoId: string, cantidad: number, ahora: Date): Evento {
    this.#exigirNoRealizadoParaComprar(ahora);
    const tipo = this.#tipoOFallar(tipoId);
    if (!tipo.hayCupoPara(cantidad)) {
      throw new ReglaDeNegocioError("CUPO_INSUFICIENTE", mensajeDeCupo(tipo));
    }
    const descontado = tipo.descontar(cantidad);
    return this.#con({
      tiposEntrada: this.tiposEntrada.map((otro) => (otro.id === tipoId ? descontado : otro)),
    });
  }

  /**
   * Devuelve el cupo liberado por compras vencidas (`porTipo`: entradas por id de tipo; los ids
   * ausentes se ignoran). Sin chequeo de "realizado": una compra vence igual con el evento empezado
   * y su cupo vuelve (research R9).
   */
  devolverCupos(porTipo: ReadonlyMap<string, number>): Evento {
    return this.#con({
      tiposEntrada: this.tiposEntrada.map((tipo) => {
        const cantidad = porTipo.get(tipo.id);
        return cantidad === undefined ? tipo : tipo.devolver(cantidad);
      }),
    });
  }

  /** Mismo código que el de las ediciones, con el mensaje de la compra. */
  #exigirNoRealizadoParaComprar(ahora: Date): void {
    if (this.estaRealizado(ahora)) {
      throw new ReglaDeNegocioError(
        "EVENTO_REALIZADO",
        "El evento ya se realizó: no se pueden comprar entradas.",
      );
    }
  }

  #exigirNoRealizado(ahora: Date): void {
    if (this.estaRealizado(ahora)) {
      throw new ReglaDeNegocioError("EVENTO_REALIZADO", "El evento ya se realizó: no se puede modificar.");
    }
  }

  /** Red de seguridad: el service ya respondió 404 si el tipo no es de este evento (R5). */
  #tipoOFallar(tipoId: string): TipoEntrada {
    const tipo = this.buscarTipoEntrada(tipoId);
    if (!tipo) {
      throw new ReglaDeNegocioError(
        "TIPO_ENTRADA_NO_ENCONTRADO",
        "No existe el tipo de entrada en este evento.",
      );
    }
    return tipo;
  }

  /** Un Evento nuevo con estos cambios, verificado por el constructor. */
  #con(cambios: Partial<PropiedadesEvento>): Evento {
    return new Evento({
      id: this.id,
      nombre: this.nombre,
      descripcion: this.descripcion,
      categoriaId: this.categoriaId,
      fechaHora: this.fechaHora,
      multimedia: [...this.multimedia],
      organizadorId: this.organizadorId,
      tiposEntrada: [...this.tiposEntrada],
      ...cambios,
    });
  }

  /**
   * ¿Algún tipo de entrada tiene un precio entre `min` y `max` (inclusive)? (diagrama de la
   * consigna). El filtro por rango de precio quedó fuera de alcance de la 005: todavía no lo usa
   * ninguna feature.
   */
  tuPrecioEstaEntre(min: number, max: number): boolean {
    return this.tiposEntrada.some((tipo) => tipo.precio >= min && tipo.precio <= max);
  }
}

/**
 * Orden de Mis eventos (FR-004) según `ahora`: primero los próximos, del más cercano al más lejano;
 * después los realizados, del más reciente al más antiguo.
 */
export function ordenDeMisEventos(ahora: Date): (a: Evento, b: Evento) => number {
  return (a, b) => {
    const aRealizado = a.estaRealizado(ahora);
    if (aRealizado !== b.estaRealizado(ahora)) return aRealizado ? 1 : -1;
    const diferencia = a.fechaHora.getTime() - b.fechaHora.getTime();
    return aRealizado ? -diferencia : diferencia;
  };
}
