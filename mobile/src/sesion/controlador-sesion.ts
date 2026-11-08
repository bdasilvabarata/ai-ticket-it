import type { UsuarioVista } from "@ai-ticket-it/shared";

import { ServidorNoDisponibleError, type ClienteApi } from "../api";
import type { Dependencias } from "../composicion";
import { SecuenciaDeReintentos, type EstadoSecuencia } from "../conexion/secuencia-reintentos";
import { claves } from "../consultas/claves";
import { estadoInicial, reducirSesion, type EstadoSesion, type EventoSesion } from "./estado-sesion";

export interface OpcionesControlador {
  dependencias: Dependencias;
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

  function aplicar(evento: EventoSesion): void {
    estado = reducirSesion(estado, evento);
    despachar(evento);
  }

  const usuarioIdActual = () => (estado.fase === "con-usuario" ? estado.usuarioId : null);

  const cliente = dependencias.crearCliente({
    obtenerUsuarioId: usuarioIdActual,
    alUsuarioNoIdentificado: () => {},
  });

  async function intentarSegunFase(): Promise<boolean> {
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

  function alFallarConsulta(error: unknown): void {
    if (error instanceof ServidorNoDisponibleError) secuencia.iniciar();
  }

  return {
    cliente,

    iniciar() {
      const desuscribir = dependencias.registrarOyenteDeErrores(alFallarConsulta);
      void (async () => {
        const usuarioId = await usuarioRecordado.leer();
        if (usuarioId === null) aplicar({ tipo: "sin-recordado" });
      })();
      return () => {
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
  };
}
