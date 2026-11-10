/**
 * Tema único de la app (FR-011, research R6, data-model "Tema"): colores, espacios, tamaños de
 * texto, pesos, radios y opacidad. Ningún componente define estos valores sueltos.
 */
export const tema = {
  colores: {
    texto: "#1f2933",
    textoSecundario: "#52606d",
    // Verde del logo oscurecido: con texto blanco encima llega a 5:1 (el del logo da 1,8:1).
    primario: "#15803d",
    sobrePrimario: "#ffffff",
    // Verde exacto del logo: solo para acentos sin texto encima.
    marca: "#69d73c",
    fondo: "#ffffff",
    borde: "#d9e2ec",
    avisoFondo: "#fff4ce",
    avisoTexto: "#5c3c00",
    // Estados de compra (siempre junto a su etiqueta de texto, no solo el color):
    // éxito → CONFIRMADA y UTILIZADA; peligro → CANCELADA y REEMBOLSADA; advertencia → PENDIENTE.
    exito: "#166534",
    sobreExito: "#ffffff",
    peligro: "#b91c1c",
    sobrePeligro: "#ffffff",
    advertencia: "#b45309",
    sobreAdvertencia: "#ffffff",
    // Marca "Realizado" de un evento (siempre con la etiqueta escrita): 6,4:1 con blanco encima.
    neutro: "#52606d",
    sobreNeutro: "#ffffff",
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
  logo: {
    alto: 150,
  },
  opacidadApagado: 0.6,
} as const;
