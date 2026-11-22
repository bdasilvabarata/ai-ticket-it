import { useCallback, useRef } from "react";

/**
 * Un envío a la vez (research R11): devuelve `enviarUnaVez(enviar)`, que no hace nada si hay otro
 * envío en curso y, si no, llama a `enviar` con la función que lo da por terminado (para el
 * `onSettled` de la mutation). La marca es sincrónica (un `useRef`) porque un `Alert` puede responder
 * dos veces antes de que la pantalla se vuelva a dibujar con `isPending`.
 */
export function useEnvioUnico(): (enviar: (alTerminar: () => void) => void) => void {
  const enCurso = useRef(false);
  return useCallback((enviar: (alTerminar: () => void) => void) => {
    if (enCurso.current) return;
    enCurso.current = true;
    enviar(() => {
      enCurso.current = false;
    });
  }, []);
}
