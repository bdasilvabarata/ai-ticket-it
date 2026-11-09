import { StyleSheet, View } from "react-native";

import { Cargando } from "./Cargando";
import { Logo } from "./Logo";
import { tema } from "./tema";

/** Espera inicial de la app (ruta `cargando`): el logo y Cargando… */
export function CargandoInicio() {
  return (
    <View style={estilos.pantalla}>
      <View style={estilos.logo}>
        <Logo />
      </View>
      <Cargando />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: "center", backgroundColor: tema.colores.fondo },
  logo: { paddingTop: tema.espacio.amplio },
});
