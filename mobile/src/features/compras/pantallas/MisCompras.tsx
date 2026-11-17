import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ListaVacia, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { FilaMiCompra } from "../componentes/FilaMiCompra";
import { useMisCompras } from "../useMisCompras";

/**
 * "Mis compras" (feature 007, UC-01): todas las compras del usuario actual como comprador, de todos
 * los eventos, al día y en el orden del servidor (sin reordenar, agrupar ni filtrar: FR-007).
 */
export function MisCompras() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <ListaDeMisCompras usuarioId={estado.usuarioId} />;
}

const irAExplorar = () => router.navigate("/");

function ListaDeMisCompras({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisCompras(usuarioId);
  return (
    <View style={estilos.pantalla}>
      <SegunConsulta
        consulta={consulta}
        vacio={
          <ListaVacia
            mensaje="Todavía no compraste entradas"
            icono="ticket-outline"
            accion={{ texto: "Ir a Explorar", alPresionar: irAExplorar }}
          />
        }
      >
        {(compras) => (
          <PantallaDesplazable separacion={tema.espacio.medio}>
            {compras.map((compra) => (
              <FilaMiCompra key={compra.id} compra={compra} />
            ))}
          </PantallaDesplazable>
        )}
      </SegunConsulta>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
});
