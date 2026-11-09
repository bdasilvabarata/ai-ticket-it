import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores } from "../../../componentes/estilos";
import { useSesion } from "../SesionProvider";

/** Perfil: el usuario actual y "Cambiar usuario" (contracts/app.md "Perfil", FR-019). */
export function Perfil() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta

  const { usuario, usuarioId } = estado;
  return (
    <View style={estilos.contenedor}>
      {usuario ? (
        <Text style={estilos.nombre} accessibilityRole="header">
          {`${usuario.nombre} ${usuario.apellido}`}
        </Text>
      ) : (
        <>
          <Text style={estilos.nombre} accessibilityRole="header">
            {`Usuario ${usuarioId}`}
          </Text>
          <Text style={estilos.aviso}>No se pudieron cargar los datos del usuario.</Text>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/seleccionar-usuario")}
        style={({ pressed }) => [estilos.boton, pressed && estilos.presionado]}
      >
        <Text style={estilos.textoBoton}>Cambiar usuario</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  nombre: { fontSize: 22, fontWeight: "600", color: colores.texto, textAlign: "center" },
  aviso: { fontSize: 15, color: colores.textoSecundario, textAlign: "center" },
  boton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colores.primario,
  },
  presionado: { opacity: 0.6 },
  textoBoton: { color: colores.sobrePrimario, fontSize: 16, fontWeight: "600" },
});
