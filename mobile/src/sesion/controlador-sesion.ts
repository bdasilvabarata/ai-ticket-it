import type { UsuarioVista } from "@ai-ticket-it/shared";
import type { QueryClient } from "@tanstack/react-query";

import { obtenerUsuarioActual, ServidorNoDisponibleError, type ClienteApi } from "../api";
import { SecuenciaDeReintentos, type EstadoSecuencia } from "../conexion/secuencia-reintentos";
import { claves } from "../consultas/claves";
import { estadoInicial, reducirSesion, type EstadoSesion, type EventoSesion } from "./estado-sesion";
import type { RepositorioUsuarioRecordado } from "./usuario-recordado";
import { decidirValidacion, type DecisionValidacion } from "./validacion";

export interface OpcionesCliente {
  obtenerUsuarioId: () => string | null;
  alUsuarioNoIdentificado: (usuarioId: string) => void;
}

/** Lo que la sesión necesita, inyectado por props a `SesionProvider` (research R2). */
export interface DependenciasSesion {
  urlBase: string;
  usuarioRecordado: RepositorioUsuarioRecordado;
  queryClient: QueryClient;
  crearCliente(opciones: OpcionesCliente): ClienteApi;
  /** La sesión se entera de los errores de toda query o mutation (R8). Devuelve cómo desuscribirse. */
  registrarOyenteDeErrores(oyente: (error: unknown) => void): () => void;
}

export interface OpcionesControlador {
  dependencias: DependenciasSesion;
  /** El `dispatch` del reducer de React: recibe los mismos eventos que el estado interno. */
  despachar: (evento: EventoSesion) => void;
  alCambiarSecuencia: (estado: EstadoSecuencia) => void;
}

export interface ControladorSesion {
  readonly cliente: ClienteApi;
  /** Lee lo recordado y se suscribe a los errores de las consultas. Devuelve cómo detenerse. */
  iniciar(): () => void;
  elegirUsuario(usuario: UsuarioVista): Promise<void>;
  reintentarAhora(): Promise<void>;
  /** La app volvió a primer plano: con la franja visible, valida en el acto (CHK005). */
  alVolverAPrimerPlano(): void;
}

/**
 * La lógica de la sesión, sin React (R5). Lleva su propia copia del estado, calculada con el mismo
 * reducer puro que usa React, para que el cliente HTTP lea el usuario actual en el acto, sin
 * esperar a que React vuelva a renderizar.
 */
export function crearControladorSesion({
  dependencias,
  despachar,
  alCambiarSecuencia,
}: OpcionesControlador): ControladorSesion {
  const { queryClient, usuarioRecordado } = dependencias;
  let estado: EstadoSesion = estadoInicial;
  let eligiendo = false;
  let olvidando = false;
  let detenido = false;

  function aplicar(evento: EventoSesion): void {
    estado = reducirSesion(estado, evento);
    despachar(evento);
  }

  const usuarioIdActual = () => (estado.fase === "con-usuario" ? estado.usuarioId : null);

  const cliente = dependencias.crearCliente({
    obtenerUsuarioId: usuarioIdActual,
    // Un 401 de un pedido hecho en nombre de otro usuario (uno anterior) se ignora.
    alUsuarioNoIdentificado: (usuarioId) => {
      if (usuarioId === usuarioIdActual()) void olvidarUsuario(usuarioId);
    },
  });

  /** Regla de FR-013 sobre `GET /usuarios/actual` en nombre de `usuarioId`. */
  async function validar(usuarioId: string): Promise<DecisionValidacion> {
    try {
      return decidirValidacion({ ok: true, usuario: await obtenerUsuarioActual(cliente, usuarioId) });
    } catch (error) {
      return decidirValidacion({ ok: false, error });
    }
  }

  async function olvidarRecordado(): Promise<void> {
    try {
      await usuarioRecordado.olvidar();
    } catch (error) {
      console.warn("No se pudo olvidar al usuario recordado.", error);
    }
  }

  /**
   * Olvida al usuario actual y vuelve al selector con el aviso. Idempotente (U2): si la fase ya no
   * es `con-usuario`, el usuario cambió o ya se lo está olvidando, no hace nada. Así un 401 que llega
   * por el cliente y por la validación a la vez borra la clave una sola vez.
   */
  async function olvidarUsuario(usuarioId: string): Promise<void> {
    if (olvidando || usuarioIdActual() !== usuarioId) return;
    olvidando = true;
    try {
      await queryClient.cancelQueries();
      queryClient.clear(); // nada del usuario olvidado queda en caché (FR-016)
      await olvidarRecordado();
      aplicar({ tipo: "usuario-no-identificado", usuarioId });
    } finally {
      olvidando = false;
    }
  }

  async function validarAlIniciar(usuarioId: string): Promise<void> {
    const decision = await validar(usuarioId);
    if (detenido) return;
    if (decision.tipo === "olvidar") await olvidarRecordado();
    aplicar({ tipo: "validado", usuarioId, decision });
    if (decision.tipo === "conservar-sin-servidor") secuencia.iniciar();
  }

  async function intentarSegunFase(): Promise<boolean> {
    if (estado.fase === "con-usuario") {
      // Éxito solo si el servidor respondió algo concluyente; un 500 también es fallo (I1).
      const { usuarioId } = estado;
      const decision = await validar(usuarioId);
      if (decision.tipo === "olvidar") {
        await olvidarUsuario(usuarioId);
        return true;
      }
      aplicar({ tipo: "validado", usuarioId, decision });
      return decision.tipo === "confirmado";
    }
    if (estado.fase === "sin-usuario") {
      await queryClient.refetchQueries({ queryKey: claves.usuarios() });
      const error = queryClient.getQueryState(claves.usuarios())?.error;
      return !(error instanceof ServidorNoDisponibleError);
    }
    return false;
  }

  const secuencia = new SecuenciaDeReintentos({
    intentar: async () => {
      const exito = await intentarSegunFase();
      if (exito) {
        // Vuelve a pedir lo que había fallado (la lista del selector, las pantallas de 003+).
        void queryClient.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" });
      }
      return exito;
    },
    alCambiar: alCambiarSecuencia,
  });

  // Los 401 llegan por `alUsuarioNoIdentificado` del cliente, que sabe en nombre de quién se pidió.
  function alFallarConsulta(error: unknown): void {
    if (!(error instanceof ServidorNoDisponibleError)) return;
    aplicar({ tipo: "servidor-no-disponible" });
    secuencia.iniciar();
  }

  return {
    cliente,

    iniciar() {
      const desuscribir = dependencias.registrarOyenteDeErrores(alFallarConsulta);
      void (async () => {
        const usuarioId = await usuarioRecordado.leer();
        if (detenido) return;
        if (usuarioId === null) aplicar({ tipo: "sin-recordado" });
        else await validarAlIniciar(usuarioId);
      })();
      return () => {
        detenido = true;
        desuscribir();
        secuencia.detener();
      };
    },

    async elegirUsuario(usuario) {
      if (eligiendo) return; // doble toque
      eligiendo = true;
      try {
        secuencia.detener(); // la lista llegó del servidor: está disponible (A1)
        try {
          await usuarioRecordado.guardar(usuario.id);
        } catch (error) {
          // Entra igual con el elegido, sin recordarlo (CHK004).
          console.warn("No se pudo recordar al usuario elegido.", error);
        }
        await queryClient.cancelQueries();
        queryClient.clear(); // nada del usuario anterior llega al nuevo (FR-016)
        aplicar({ tipo: "elegido", usuario });
      } finally {
        eligiendo = false;
      }
    },

    reintentarAhora: () => secuencia.reintentarAhora(),

    alVolverAPrimerPlano() {
      if (estado.fase === "con-usuario" && estado.servidor === "no-disponible") {
        void secuencia.reintentarAhora();
      }
    },
  };
}
