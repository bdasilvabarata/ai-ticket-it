import { createContext, useContext, type ReactNode } from "react";

/**
 * Estado de la conexión con el servidor (data-model "EstadoConexion"). Es un contrato de la base:
 * lo provee la sesión y lo leen la franja y `SegunConsulta`, sin importar la feature `sesion`.
 */
export interface EstadoConexion {
  servidor: "disponible" | "no-disponible";
  enCurso: boolean;
  automaticosRestantes: number;
  reintentarAhora: () => Promise<void>;
  urlBase: string;
}

const ContextoConexion = createContext<EstadoConexion | null>(null);

export function ConexionProvider({ valor, children }: { valor: EstadoConexion; children: ReactNode }) {
  return <ContextoConexion.Provider value={valor}>{children}</ContextoConexion.Provider>;
}

export function useConexion(): EstadoConexion {
  const valor = useContext(ContextoConexion);
  if (!valor) throw new Error("useConexion se usa dentro de ConexionProvider");
  return valor;
}
