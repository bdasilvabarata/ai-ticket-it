import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { nombreCompleto } from "../../usuarios";
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
          {nombreCompleto(usuario)}
        </Text>
      ) : (
        <>
          <Text style={estilos.nombre} accessibilityRole="header">
            {`Usuario ${usuarioId}`}
          </Text>
          <Text style={estilos.aviso}>No se pudieron cargar los datos del usuario.</Text>
        </>
      )}
      <Boton
        texto="Cambiar usuario"
        alPresionar={() => router.push("/seleccionar-usuario")}
        style={estilos.boton}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.medio,
  },
  nombre: {
    fontSize: tema.texto.titulo,
    fontWeight: tema.peso.fuerte,
    color: tema.colores.texto,
    textAlign: "center",
  },
  aviso: { fontSize: tema.texto.aviso, color: tema.colores.textoSecundario, textAlign: "center" },
  boton: { marginTop: tema.espacio.chico },
});
