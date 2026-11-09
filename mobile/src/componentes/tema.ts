/**
 * Tema único de la app (FR-011, research R6, data-model "Tema"): colores, espacios, tamaños de
 * texto, pesos, radios y opacidad. Ningún componente define estos valores sueltos.
 */
export const tema = {
  colores: {
    texto: "#1f2933",
    textoSecundario: "#52606d",
    primario: "#1d4ed8",
    sobrePrimario: "#ffffff",
    fondo: "#ffffff",
    borde: "#d9e2ec",
    avisoFondo: "#fff4ce",
    avisoTexto: "#5c3c00",
  },
  espacio: {
    minimo: 2,
    chico: 8,
    medio: 12,
    fila: 14,
    normal: 16,
    grande: 20,
    amplio: 24,
  },
  texto: {
    chico: 14,
    aviso: 15,
    normal: 16,
    destacado: 17,
    subtitulo: 18,
    titulo: 22,
  },
  peso: {
    medio: "500",
    fuerte: "600",
  },
  radio: {
    normal: 8,
  },
  opacidadApagado: 0.6,
} as const;
