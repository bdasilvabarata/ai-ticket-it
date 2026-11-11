import { useIsFocused, usePreventRemove } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { useSesion } from "../sesion";

/**
 * Confirmación al salir de un formulario (FR-026a, research R12). El atrás del header, el de
 * Android y el gesto de iOS remueven la pantalla: se retienen y se pregunta "¿Descartar los
 * cambios?", **siempre**, haya cambios o no.
 *
 * No pregunta:
 * - si la pantalla no es la que se está viendo: una salida que la saca de abajo del Stack (volver a
 *   Mis eventos desde un formulario de tipo) la decide la pantalla de arriba;
 * - si la sesión ya no es la del formulario (un 401 olvidó al usuario o cambió el usuario): esa
 *   salida la provoca el guard de la sesión;
 * - después de `salirSinConfirmar(navegar)`, que se usa tras guardar o eliminar con éxito y ante un
 *   404: la navegación ocurre en un efecto, cuando el hook ya no retiene;
 * - si `habilitado` es `false`.
 */
export function useConfirmarDescarte({ habilitado = true }: { habilitado?: boolean } = {}) {
  const { estado } = useSesion();
  const [usuarioDelFormulario] = useState(estado.fase === "con-usuario" ? estado.usuarioId : null);
  const [salida, setSalida] = useState<{ navegar: () => void } | null>(null);
  const [descartado, setDescartado] = useState(false);

  const enfocada = useIsFocused();

  const mismaSesion = estado.fase === "con-usuario" && estado.usuarioId === usuarioDelFormulario;
  const retener = habilitado && enfocada && mismaSesion && salida === null && !descartado;

  usePreventRemove(retener, ({ repeat }) => {
    Alert.alert("¿Descartar los cambios?", undefined, [
      { text: "Seguir editando", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: () => {
          setDescartado(true);
          repeat();
        },
      },
    ]);
  });

  useEffect(() => {
    salida?.navegar();
  }, [salida]);

  return {
    /** Sale sin preguntar: deja de retener y después navega. */
    salirSinConfirmar: (navegar: () => void) => setSalida({ navegar }),
  };
}
