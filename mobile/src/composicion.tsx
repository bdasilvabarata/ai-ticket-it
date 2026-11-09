import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { createContext, useContext, type ReactNode } from "react";

import { crearClienteApi, resolverUrlBase, type ClienteApi } from "./api";
import { crearQueryClient } from "./consultas/query-client";
import {
  crearRepositorioUsuarioRecordado,
  type Almacenamiento,
  type RepositorioUsuarioRecordado,
} from "./sesion/usuario-recordado";

export interface OpcionesCliente {
  obtenerUsuarioId: () => string | null;
  alUsuarioNoIdentificado: (usuarioId: string) => void;
}

/** Piezas de la app, armadas en un solo lugar (data-model "Dependencias"). */
export interface Dependencias {
  urlBase: string;
  usuarioRecordado: RepositorioUsuarioRecordado;
  queryClient: QueryClient;
  crearCliente(opciones: OpcionesCliente): ClienteApi;
  /** La sesión se entera de los errores de toda query o mutation (R8). Devuelve cómo desuscribirse. */
  registrarOyenteDeErrores(oyente: (error: unknown) => void): () => void;
}

export interface EntradaDependencias {
  fetch: typeof fetch;
  almacenamiento: Almacenamiento;
  urlEntorno?: string;
  hostUri?: string | null;
}

/** Composition root de la app: el único lugar que instancia piezas. */
export function crearDependencias({
  fetch,
  almacenamiento,
  urlEntorno,
  hostUri,
}: EntradaDependencias): Dependencias {
  const urlBase = resolverUrlBase({ urlEntorno, hostUri });
  const oyentes = new Set<(error: unknown) => void>();
  const queryClient = crearQueryClient({
    alFallar: (error) => oyentes.forEach((oyente) => oyente(error)),
  });

  return {
    urlBase,
    usuarioRecordado: crearRepositorioUsuarioRecordado(almacenamiento),
    queryClient,
    crearCliente: ({ obtenerUsuarioId, alUsuarioNoIdentificado }) =>
      crearClienteApi({ fetch, urlBase, obtenerUsuarioId, alUsuarioNoIdentificado }),
    registrarOyenteDeErrores(oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
  };
}

/** Dependencias reales: `fetch` global, AsyncStorage y la dirección de Expo (R10). */
export function crearDependenciasDeProduccion(): Dependencias {
  return crearDependencias({
    fetch: (entrada, init) => fetch(entrada, init),
    almacenamiento: AsyncStorage,
    // Expo solo reemplaza el acceso literal a la variable (R10).
    urlEntorno: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri ?? null,
  });
}

const ContextoDependencias = createContext<Dependencias | null>(null);

export function DependenciasProvider({
  dependencias,
  children,
}: {
  dependencias: Dependencias;
  children: ReactNode;
}) {
  return <ContextoDependencias.Provider value={dependencias}>{children}</ContextoDependencias.Provider>;
}

export function useDependencias(): Dependencias {
  const dependencias = useContext(ContextoDependencias);
  if (!dependencias) throw new Error("useDependencias se usa dentro de DependenciasProvider");
  return dependencias;
}
