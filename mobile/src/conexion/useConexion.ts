import { useSecuenciaDeLaSesion } from "../sesion/SesionProvider";

export interface EstadoConexion {
  servidor: "disponible" | "no-disponible";
  enCurso: boolean;
  automaticosRestantes: number;
  reintentarAhora: () => Promise<void>;
  urlBase: string;
}

/** Estado de conexión derivado de la sesión y de la secuencia única (data-model "EstadoConexion"). */
export function useConexion(): EstadoConexion {
  const { estado, secuencia, reintentar, urlBase } = useSecuenciaDeLaSesion();
  return {
    servidor: estado.fase === "con-usuario" ? estado.servidor : "disponible",
    enCurso: secuencia.enCurso,
    automaticosRestantes: secuencia.automaticosRestantes,
    reintentarAhora: reintentar,
    urlBase,
  };
}
