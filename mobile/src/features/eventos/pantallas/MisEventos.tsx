import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Boton, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { FilaEvento } from "../componentes/FilaEvento";
import { useMisEventos } from "../useMisEventos";

/** Mis eventos: los que organiza el usuario actual (contracts/app.md, "Mis eventos"). */
export function MisEventos() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeMisEventos usuarioId={estado.usuarioId} />;
}

const crearEvento = () => router.push("/eventos/nuevo");

function ListaDeMisEventos({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisEventos(usuarioId);
  return (
    <View style={estilos.pantalla}>
      {/* El vacío lleva su propia acción ("Crear tu primer evento"), así que lo resuelve la lista. */}
      <SegunConsulta consulta={consulta} mensajeVacio="" esVacio={(eventos) => eventos === undefined}>
        {(eventos) =>
          eventos.length === 0 ? (
            <View style={estilos.vacio}>
              <Text style={estilos.textoVacio}>Todavía no organizás eventos.</Text>
              <Boton texto="Crear tu primer evento" alPresionar={crearEvento} />
            </View>
          ) : (
            <FlatList
              data={eventos}
              keyExtractor={(evento) => evento.id}
              ListHeaderComponent={
                <View style={estilos.acciones}>
                  <Boton texto="Crear evento" alPresionar={crearEvento} />
                </View>
              }
              renderItem={({ item }) => <FilaEvento evento={item} />}
            />
          )
        }
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  acciones: { padding: tema.espacio.normal },
  vacio: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tema.espacio.amplio,
    gap: tema.espacio.medio,
  },
  textoVacio: { fontSize: tema.texto.normal, textAlign: "center", color: tema.colores.textoSecundario },
});
