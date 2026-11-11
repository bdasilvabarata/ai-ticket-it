import type { UsuarioVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo, SegunConsulta, tema } from "../../../componentes";
import { FilaUsuario, useUsuarios } from "../../usuarios";
import { useSesion } from "../SesionProvider";

const AVISO_USUARIO_INEXISTENTE = "El usuario con el que estabas operando ya no existe. Elegí otro.";

/** Selector de usuario (contracts/app.md "Seleccionar usuario"). */
export function SeleccionarUsuario() {
  const { estado, elegirUsuario } = useSesion();
  const consulta = useUsuarios();
  const [eligiendo, setEligiendo] = useState(false);

  // Con usuario, el selector es el modal de "Cambiar usuario" (FR-015).
  const enModal = estado.fase === "con-usuario";
  const usuarioIdActual = estado.fase === "con-usuario" ? estado.usuarioId : null;
  const conAviso = estado.fase === "sin-usuario" && estado.aviso === "usuario-anterior-inexistente";

  useEffect(() => {
    if (conAviso) AccessibilityInfo.announceForAccessibility(AVISO_USUARIO_INEXISTENTE);
  }, [conAviso]);

  function alElegir(usuario: UsuarioVista) {
    setEligiendo(true);
    void elegirUsuario(usuario)
      .then(() => {
        // El selector sigue disponible con usuario (es el modal de Perfil): hay que salir de él.
        if (enModal) router.back();
        else router.replace("/");
      })
      .finally(() => setEligiendo(false));
  }

  return (
    <SafeAreaView style={estilos.pantalla} edges={enModal ? ["bottom"] : ["top", "bottom"]}>
      {/* El logo da la bienvenida; en el modal de "Cambiar usuario" no hace falta. */}
      {enModal ? null : (
        <View style={estilos.logo}>
          <Logo />
        </View>
      )}
      {conAviso ? (
        <View style={estilos.aviso} accessibilityLiveRegion="polite">
          <Text style={estilos.textoAviso}>{AVISO_USUARIO_INEXISTENTE}</Text>
        </View>
      ) : null}
      <View style={estilos.contenido}>
        <SegunConsulta consulta={consulta} mensajeVacio="No hay usuarios disponibles.">
          {(usuarios) => (
            <FlatList
              data={usuarios}
              keyExtractor={(usuario) => usuario.id}
              ListHeaderComponent={
                <Text style={estilos.titulo} accessibilityRole="header">
                  ¿Con quién querés operar?
                </Text>
              }
              renderItem={({ item }) => (
                <FilaUsuario
                  usuario={item}
                  esActual={item.id === usuarioIdActual}
                  deshabilitada={eligiendo}
                  alElegir={alElegir}
                />
              )}
            />
          )}
        </SegunConsulta>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  contenido: { flex: 1 },
  logo: { paddingTop: tema.espacio.normal },
  aviso: {
    marginHorizontal: tema.espacio.normal,
    marginTop: tema.espacio.normal,
    padding: tema.espacio.medio,
    borderRadius: tema.radio.normal,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.avisoFondo,
  },
  textoAviso: { ...tema.tipografia.mensaje, color: tema.colores.avisoTexto },
  titulo: {
    ...tema.tipografia.titulo,
    color: tema.colores.texto,
    paddingHorizontal: tema.espacio.normal,
    paddingTop: tema.espacio.normal,
    paddingBottom: tema.espacio.chico,
  },
});
