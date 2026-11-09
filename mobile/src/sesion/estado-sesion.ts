import type { UsuarioVista } from "@ai-ticket-it/shared";

import type { DecisionValidacion } from "./validacion";

export type AvisoSesion = "usuario-anterior-inexistente";

export type EstadoSesion =
  | { fase: "iniciando" }
  | { fase: "sin-usuario"; aviso: AvisoSesion | null }
  | {
      fase: "con-usuario";
      usuarioId: string;
      /** `null` = conservado sin poder confirmarlo con el servidor. */
      usuario: UsuarioVista | null;
      servidor: "disponible" | "no-disponible";
    };

export type EventoSesion =
  | { tipo: "sin-recordado" }
  | { tipo: "validado"; usuarioId: string; decision: DecisionValidacion }
  | { tipo: "servidor-no-disponible" }
  | { tipo: "usuario-no-identificado"; usuarioId: string }
  | { tipo: "elegido"; usuario: UsuarioVista };

export const estadoInicial: EstadoSesion = { fase: "iniciando" };

const conAviso: EstadoSesion = { fase: "sin-usuario", aviso: "usuario-anterior-inexistente" };

/** Transiciones de la sesión (data-model "EstadoSesion"). Una combinación no listada no cambia nada. */
export function reducirSesion(estado: EstadoSesion, evento: EventoSesion): EstadoSesion {
  switch (evento.tipo) {
    case "sin-recordado":
      return estado.fase === "iniciando" ? { fase: "sin-usuario", aviso: null } : estado;

    case "validado": {
      const { usuarioId, decision } = evento;
      if (estado.fase === "iniciando") {
        if (decision.tipo === "olvidar") return conAviso;
        return decision.tipo === "confirmado"
          ? { fase: "con-usuario", usuarioId, usuario: decision.usuario, servidor: "disponible" }
          : { fase: "con-usuario", usuarioId, usuario: null, servidor: "no-disponible" };
      }
      // Un validado de otro usuario llega tarde, después de un cambio de usuario: se descarta.
      if (estado.fase !== "con-usuario" || estado.usuarioId !== usuarioId) return estado;
      if (decision.tipo === "olvidar") return conAviso;
      if (decision.tipo === "confirmado")
        return { ...estado, usuario: decision.usuario, servidor: "disponible" };
      return estado.servidor === "no-disponible" ? estado : { ...estado, servidor: "no-disponible" };
    }

    case "servidor-no-disponible":
      if (estado.fase !== "con-usuario" || estado.servidor === "no-disponible") return estado;
      return { ...estado, servidor: "no-disponible" };

    case "usuario-no-identificado":
      return estado.fase === "con-usuario" && estado.usuarioId === evento.usuarioId ? conAviso : estado;

    case "elegido":
      if (estado.fase === "iniciando") return estado;
      return {
        fase: "con-usuario",
        usuarioId: evento.usuario.id,
        usuario: evento.usuario,
        servidor: "disponible",
      };
  }
}
