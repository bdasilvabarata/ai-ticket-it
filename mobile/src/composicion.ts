import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { crearClienteApi, resolverUrlBase } from "./api";
import { crearQueryClient } from "./consultas/query-client";
import {
  crearRepositorioUsuarioRecordado,
  type Almacenamiento,
  type DependenciasSesion,
} from "./features/sesion";

/** Piezas de la app, armadas en un solo lugar (data-model "Dependencias"); hoy, las de la sesión. */
export type Dependencias = DependenciasSesion;

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
