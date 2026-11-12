import { useEffect, useState } from "react";

/**
 * El `valor` recién cuando dejó de cambiar durante `ms` (debounce del buscador de Explorar: 500 ms
 * después de la última tecla). Cada cambio cancela la espera anterior.
 */
export function useValorDemorado<T>(valor: T, ms: number): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return demorado;
}
