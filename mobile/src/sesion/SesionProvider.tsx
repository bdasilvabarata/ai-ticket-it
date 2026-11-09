import type { UsuarioVista } from "@ai-ticket-it/shared";
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import type { ClienteApi } from "../api";
import { useDependencias } from "../composicion";
import { SecuenciaDeReintentos, type EstadoSecuencia } from "../conexion/secuencia-reintentos";
import { crearControladorSesion } from "./controlador-sesion";
import { estadoInicial, reducirSesion, type EstadoSesion } from "./estado-sesion";

interface ValorSesion {
  estado: EstadoSesion;
  elegirUsuario(usuario: UsuarioVista): Promise<void>;
  reintentar(): Promise<void>;
  cliente: ClienteApi;
  secuencia: EstadoSecuencia;
  urlBase: string;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

const secuenciaInicial: EstadoSecuencia = {
  enCurso: false,
  automaticosRestantes: SecuenciaDeReintentos.esperasMs.length,
};

/** Sesión de la app: usuario actual, cliente HTTP y la única secuencia de reintentos (R5, R7). */
export function SesionProvider({ children }: { children: ReactNode }) {
  const dependencias = useDependencias();
  const [estado, despachar] = useReducer(reducirSesion, estadoInicial);
  const [secuencia, setSecuencia] = useState(secuenciaInicial);
  const [controlador] = useState(() =>
    crearControladorSesion({ dependencias, despachar, alCambiarSecuencia: setSecuencia }),
  );

  useEffect(() => controlador.iniciar(), [controlador]);

  // Sin pausa manual en segundo plano: al volver, si la franja está visible, valida en el acto (CHK005).
  useEffect(() => {
    const suscripcion = AppState.addEventListener("change", (estadoApp) => {
      if (estadoApp === "active") controlador.alVolverAPrimerPlano();
    });
    return () => suscripcion.remove();
  }, [controlador]);

  const valor: ValorSesion = {
    estado,
    elegirUsuario: controlador.elegirUsuario,
    reintentar: controlador.reintentarAhora,
    cliente: controlador.cliente,
    secuencia,
    urlBase: dependencias.urlBase,
  };
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

function useValorSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error("La sesión se usa dentro de SesionProvider");
  return valor;
}

export function useSesion() {
  const { estado, elegirUsuario, reintentar } = useValorSesion();
  return { estado, elegirUsuario, reintentar };
}

export function useClienteApi(): ClienteApi {
  return useValorSesion().cliente;
}

/** Uso interno de `useConexion`. */
export function useSecuenciaDeLaSesion() {
  const { estado, secuencia, reintentar, urlBase } = useValorSesion();
  return { estado, secuencia, reintentar, urlBase };
}
