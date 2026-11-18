import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { ListaVacia, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { FilaMiCompra } from "../componentes/FilaMiCompra";
import { useMisCompras } from "../useMisCompras";
import { useRefrescarAlVencer } from "../useRefrescarAlVencer";

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

/**
 * Vuelve a pedir la lista cada vez que la pestaña recupera el foco (R8), salvo el primero: el
 * montaje ya la pidió. Las pestañas no se desmontan al cambiar de una a otra y el `focusManager` de
 * TanStack solo mira el `AppState`. El callback de `useFocusEffect` es estable (lee `refetch` de una
 * ref): si cambiara su identidad estando enfocada, el hook lo volvería a correr y pediría la lista.
 */
function useRefrescarAlFocalizar(refetch: () => unknown) {
  const refetchActual = useRef(refetch);
  useEffect(() => {
    refetchActual.current = refetch;
  }, [refetch]);
  const yaEnfocada = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (yaEnfocada.current) void refetchActual.current();
      yaEnfocada.current = true;
    }, []),
  );
}

function ListaDeMisCompras({ usuarioId }: { usuarioId: string }) {
  const consulta = useMisCompras(usuarioId);
  const { refetch } = consulta;
  useRefrescarAlFocalizar(refetch);
  useRefrescarAlVencer(consulta.data, refetch);

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
