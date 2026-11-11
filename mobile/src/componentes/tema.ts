/**
 * Tema único de la app (FR-011, research R6, data-model "Tema"), con el sistema visual "Pop Brutal":
 * fondo crema, bordes negros, sombra dura sin desenfoque y tipografía Archivo. Ningún componente
 * define estos valores sueltos: colores, espacios, textos, fuentes, radios, bordes, medidas y
 * sombras salen de acá.
 */

const colores = {
  texto: "#111111",
  textoSecundario: "#5a5a5a",
  // Acciones y links: 6,2:1 con blanco encima y 5,6:1 como texto sobre el fondo.
  primario: "#2f4bf0",
  sobrePrimario: "#ffffff",
  // Verde exacto del logo: solo para acentos sin texto encima.
  marca: "#69d73c",
  fondo: "#fff4cf",
  // Tarjetas, campos, encabezados y barra de pestañas.
  superficie: "#ffffff",
  borde: "#111111",
  sombra: "#111111",
  // Pastilla de la pestaña activa y botón de texto presionado (siempre con `texto` encima: el
  // primario sobre el resaltado da 4,3:1 y no llega a AA).
  resaltado: "#ffd23f",
  // Relleno de estrellas de calificación (sin texto encima).
  estrella: "#ffb800",
  // Borde y mensaje de error de un campo.
  error: "#b3261e",
  // Solo como fondo, con `avisoTexto` encima (como texto no llega a AA).
  avisoFondo: "#ff5a36",
  avisoTexto: "#111111",
  // Estados de compra (siempre junto a su etiqueta de texto, no solo el color):
  // éxito → CONFIRMADA y UTILIZADA; peligro → CANCELADA y REEMBOLSADA; advertencia → PENDIENTE.
  exito: "#7dff9b",
  sobreExito: "#111111",
  peligro: "#ff9c86",
  sobrePeligro: "#111111",
  advertencia: "#ffd23f",
  sobreAdvertencia: "#111111",
  // Marca "Realizado" de un evento y fila presionada.
  neutro: "#e6e0cc",
  sobreNeutro: "#111111",
} as const;

const texto = {
  chico: 12,
  aviso: 13,
  normal: 15,
  destacado: 17,
  subtitulo: 20,
  titulo: 28,
} as const;

/** lineHeight de cada tamaño de `texto`. */
const alturaLinea = {
  chico: 16,
  aviso: 18,
  normal: 22,
  destacado: 24,
  subtitulo: 26,
  titulo: 32,
} as const;

const interletra = {
  titulo: -0.4,
  subtitulo: -0.2,
  normal: 0,
  mayusculas: 0.6,
} as const;

/**
 * Familias cargadas con `@expo-google-fonts` (ver `fuentes.ts`). Con fuentes propias el peso se elige
 * con la familia, nunca con `fontWeight`: en Android, combinarlos hace que se ignore la familia.
 */
const fuente = {
  display: "ArchivoBlack_400Regular",
  regular: "Archivo_400Regular",
  medio: "Archivo_500Medium",
  fuerte: "Archivo_700Bold",
} as const;

/** Estilos de texto por uso: familia, tamaño, alto de línea e interletra. El color va aparte. */
const tipografia = {
  titulo: {
    fontFamily: fuente.display,
    fontSize: texto.titulo,
    lineHeight: alturaLinea.titulo,
    letterSpacing: interletra.titulo,
  },
  subtitulo: {
    fontFamily: fuente.display,
    fontSize: texto.subtitulo,
    lineHeight: alturaLinea.subtitulo,
    letterSpacing: interletra.subtitulo,
  },
  /** Título de un encabezado de navegación. */
  encabezado: { fontFamily: fuente.display, fontSize: texto.destacado },
  tituloTarjeta: { fontFamily: fuente.fuerte, fontSize: texto.destacado, lineHeight: alturaLinea.destacado },
  cuerpo: { fontFamily: fuente.regular, fontSize: texto.normal, lineHeight: alturaLinea.normal },
  cuerpoFuerte: { fontFamily: fuente.fuerte, fontSize: texto.normal, lineHeight: alturaLinea.normal },
  secundario: { fontFamily: fuente.regular, fontSize: texto.aviso, lineHeight: alturaLinea.aviso },
  /** Mensajes de error y avisos cortos. */
  mensaje: { fontFamily: fuente.medio, fontSize: texto.aviso, lineHeight: alturaLinea.aviso },
  etiqueta: {
    fontFamily: fuente.fuerte,
    fontSize: texto.aviso,
    lineHeight: alturaLinea.aviso,
    letterSpacing: interletra.mayusculas,
    textTransform: "uppercase",
  },
  boton: { fontFamily: fuente.fuerte, fontSize: texto.destacado, lineHeight: alturaLinea.destacado },
  botonChico: { fontFamily: fuente.fuerte, fontSize: texto.normal, lineHeight: alturaLinea.normal },
  badge: {
    fontFamily: fuente.fuerte,
    fontSize: texto.chico,
    lineHeight: alturaLinea.chico,
    letterSpacing: interletra.mayusculas,
    textTransform: "uppercase",
  },
  pestana: { fontFamily: fuente.medio, fontSize: texto.chico, lineHeight: alturaLinea.chico },
  pestanaActiva: { fontFamily: fuente.fuerte, fontSize: texto.chico, lineHeight: alturaLinea.chico },
} as const;

/** Sombra dura: desplazada, sin desenfoque y opaca (prop `boxShadow`, iOS y Android). */
const sombra = {
  nivel1: `3px 3px 0px ${colores.sombra}`,
  nivel2: `4px 4px 0px ${colores.sombra}`,
} as const;

export const tema = {
  colores,
  espacio: {
    minimo: 4,
    chico: 8,
    medio: 12,
    fila: 14,
    normal: 16,
    grande: 24,
    amplio: 32,
  },
  texto,
  alturaLinea,
  interletra,
  fuente,
  tipografia,
  radio: {
    /** Botón, campo, aviso. */
    normal: 12,
    tarjeta: 14,
    /** Miniaturas dentro de tarjetas. */
    imagen: 8,
    /** Badges, chips. */
    pildora: 999,
  },
  grosor: {
    normal: 2,
    fino: 1.5,
  },
  /** Medidas fijas de componentes. */
  tamano: {
    tactil: 44,
    boton: 52,
    campo: 52,
    badge: 24,
    chip: 36,
    pastillaAncho: 44,
    pastillaAlto: 28,
    ilustracion: 72,
    iconoChico: 14,
    icono: 20,
    iconoGrande: 32,
    /** Alto de las líneas de relleno del skeleton (texto normal y título de tarjeta). */
    lineaSkeleton: 14,
    lineaSkeletonTitulo: 20,
    /** Cada imagen de la fila del detalle de un evento (proporción 16:9). */
    imagenDetalle: { ancho: 240, alto: 135 },
  },
  /** Anchos relativos de las líneas del skeleton: imitan la forma de una tarjeta. */
  anchoSkeleton: {
    titulo: "70%",
    detalle: "55%",
    corto: "35%",
  },
  sombra,
  /** Lo que se "hunde" un elemento con sombra al presionarlo (lo mismo que mide su sombra). */
  desplazamientoPresionado: 3,
  logo: {
    alto: 150,
  },
  opacidadApagado: 0.4,
} as const;

/**
 * Un elemento con sombra, presionado: se hunde hasta tapar su sombra. Va junto con quitarle la
 * sombra (`!pressed && { boxShadow: tema.sombra.nivel1 }`).
 */
export const hundido = {
  transform: [{ translateX: tema.desplazamientoPresionado }, { translateY: tema.desplazamientoPresionado }],
} as const;
