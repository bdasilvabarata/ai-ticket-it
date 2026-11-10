import { FlatList, StyleSheet, View } from "react-native";

import { SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { FilaEvento } from "../componentes/FilaEvento";
import { useMisEventos } from "../useMisEventos";

/** Mis eventos: los que organiza el usuario actual (contracts/app.md, "Mis eventos"). */
export function MisEventos() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeMisEventos usuarioId={estado.usuarioId} />;
}

function ListaDeMisEventos({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisEventos(usuarioId);
  return (
    <View style={estilos.pantalla}>
      <SegunConsulta consulta={consulta} mensajeVacio="Todavía no organizás eventos.">
        {(eventos) => (
          <FlatList
            data={eventos}
            keyExtractor={(evento) => evento.id}
            renderItem={({ item }) => <FilaEvento evento={item} />}
          />
        )}
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
});
