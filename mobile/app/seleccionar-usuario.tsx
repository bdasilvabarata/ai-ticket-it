import type { UsuarioVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorDeApi, ServidorNoDisponibleError } from "../src/api";
import { Cargando } from "../src/componentes/Cargando";
import { colores } from "../src/componentes/estilos";
import { FilaUsuario } from "../src/componentes/FilaUsuario";
import { ListaVacia } from "../src/componentes/ListaVacia";
import { MensajeError } from "../src/componentes/MensajeError";
import { useConexion } from "../src/conexion/useConexion";
import { useUsuarios } from "../src/consultas/useUsuarios";
import { useSesion } from "../src/sesion/SesionProvider";

const AVISO_USUARIO_INEXISTENTE = "El usuario con el que estabas operando ya no existe. Elegí otro.";

/** Selector de usuario (contracts/app.md "Seleccionar usuario"). */
export default function SeleccionarUsuario() {
  const { estado, elegirUsuario } = useSesion();
  const conexion = useConexion();
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

  let contenido: React.ReactNode;
  if (consulta.isPending) {
    contenido = <Cargando />;
  } else if (consulta.isError) {
    const { error } = consulta;
    contenido =
      error instanceof ServidorNoDisponibleError ? (
        <MensajeError
          titulo="Servidor no disponible"
          mensaje={`No se pudo conectar con ${conexion.urlBase}.`}
          alReintentar={() => void conexion.reintentarAhora()}
          reintentando={conexion.enCurso}
        />
      ) : (
        <MensajeError
          mensaje={error instanceof ErrorDeApi ? error.mensaje : "Ocurrió un error inesperado."}
          alReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      );
  } else if (consulta.data.length === 0) {
    contenido = <ListaVacia mensaje="No hay usuarios disponibles." />;
  } else {
    contenido = (
      <FlatList
        data={consulta.data}
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
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla} edges={enModal ? ["bottom"] : ["top", "bottom"]}>
      {conAviso ? (
        <View style={estilos.aviso} accessibilityLiveRegion="polite">
          <Text style={estilos.textoAviso}>{AVISO_USUARIO_INEXISTENTE}</Text>
        </View>
      ) : null}
      <View style={estilos.contenido}>{contenido}</View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { flex: 1 },
  aviso: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colores.avisoTexto,
    backgroundColor: colores.avisoFondo,
  },
  textoAviso: { fontSize: 15, color: colores.avisoTexto },
  titulo: {
    fontSize: 22,
    fontWeight: "600",
    color: colores.texto,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
});
