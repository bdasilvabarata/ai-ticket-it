import { createContext, useContext, type ReactNode } from "react";

import type { ClienteApi } from "../api";

/**
 * El cliente HTTP en React, como contrato de la base (R2): lo provee la sesión y lo usan los hooks
 * de consulta de cada feature, sin importar la feature `sesion`.
 */
const ContextoClienteApi = createContext<ClienteApi | null>(null);

export function ClienteApiProvider({ cliente, children }: { cliente: ClienteApi; children: ReactNode }) {
  return <ContextoClienteApi.Provider value={cliente}>{children}</ContextoClienteApi.Provider>;
}

export function useClienteApi(): ClienteApi {
  const cliente = useContext(ContextoClienteApi);
  if (!cliente) throw new Error("useClienteApi se usa dentro de ClienteApiProvider");
  return cliente;
}
