import type { UsuarioVista } from "@ai-ticket-it/shared";

import { estadoInicial, reducirSesion, type EstadoSesion } from "../../../src/features/sesion/estado-sesion";

const lucia: UsuarioVista = {
  id: "usuario-lucia",
  nombre: "Lucía",
  apellido: "Álvarez",
  cantidadEventosOrganizados: 2,
};
const diego: UsuarioVista = {
  id: "usuario-diego",
  nombre: "Diego",
  apellido: "Fernández",
  cantidadEventosOrganizados: 0,
};

const conLucia: EstadoSesion = {
  fase: "con-usuario",
  usuarioId: "usuario-lucia",
  usuario: lucia,
  servidor: "disponible",
};
const sinUsuario: EstadoSesion = { fase: "sin-usuario", aviso: null };
const inexistente: EstadoSesion = { fase: "sin-usuario", aviso: "usuario-anterior-inexistente" };

describe("reducirSesion", () => {
  it("arranca en iniciando", () => {
    expect(estadoInicial).toEqual({ fase: "iniciando" });
  });

  describe("desde iniciando", () => {
    it("sin-recordado → sin-usuario sin aviso", () => {
      expect(reducirSesion(estadoInicial, { tipo: "sin-recordado" })).toEqual(sinUsuario);
    });

    it("validado confirmado → con-usuario con el usuario y el servidor disponible", () => {
      const estado = reducirSesion(estadoInicial, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "confirmado", usuario: lucia },
      });
      expect(estado).toEqual(conLucia);
    });

    it("validado olvidar → sin-usuario con aviso de usuario inexistente", () => {
      const estado = reducirSesion(estadoInicial, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "olvidar" },
      });
      expect(estado).toEqual(inexistente);
    });

    it("validado conservar-sin-servidor → con-usuario sin datos y servidor no disponible", () => {
      const estado = reducirSesion(estadoInicial, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "conservar-sin-servidor" },
      });
      expect(estado).toEqual({
        fase: "con-usuario",
        usuarioId: "usuario-lucia",
        usuario: null,
        servidor: "no-disponible",
      });
    });

    it("elegido no aplica mientras se inicia", () => {
      expect(reducirSesion(estadoInicial, { tipo: "elegido", usuario: lucia })).toBe(estadoInicial);
    });
  });

  describe("desde con-usuario", () => {
    const conservado: EstadoSesion = { ...conLucia, usuario: null, servidor: "no-disponible" };

    it("validado confirmado → completa el usuario y marca disponible", () => {
      const estado = reducirSesion(conservado, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "confirmado", usuario: lucia },
      });
      expect(estado).toEqual(conLucia);
    });

    it("validado conservar-sin-servidor → no disponible, conserva el usuario", () => {
      const estado = reducirSesion(conLucia, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "conservar-sin-servidor" },
      });
      expect(estado).toEqual({ ...conLucia, servidor: "no-disponible" });
    });

    it("servidor-no-disponible → no disponible, conserva el usuario", () => {
      expect(reducirSesion(conLucia, { tipo: "servidor-no-disponible" })).toEqual({
        ...conLucia,
        servidor: "no-disponible",
      });
    });

    it("validado olvidar → sin-usuario con aviso", () => {
      const estado = reducirSesion(conLucia, {
        tipo: "validado",
        usuarioId: "usuario-lucia",
        decision: { tipo: "olvidar" },
      });
      expect(estado).toEqual(inexistente);
    });

    it("usuario-no-identificado con el mismo id → sin-usuario con aviso", () => {
      expect(
        reducirSesion(conLucia, { tipo: "usuario-no-identificado", usuarioId: "usuario-lucia" }),
      ).toEqual(inexistente);
    });

    it("usuario-no-identificado con otro id → sin cambios", () => {
      expect(reducirSesion(conLucia, { tipo: "usuario-no-identificado", usuarioId: "usuario-viejo" })).toBe(
        conLucia,
      );
    });

    it("un validado para otro usuarioId se descarta", () => {
      const estado = reducirSesion(conLucia, {
        tipo: "validado",
        usuarioId: "usuario-viejo",
        decision: { tipo: "olvidar" },
      });
      expect(estado).toBe(conLucia);
    });

    it("elegido → el nuevo usuario, con el servidor disponible", () => {
      expect(reducirSesion(conservado, { tipo: "elegido", usuario: diego })).toEqual({
        fase: "con-usuario",
        usuarioId: "usuario-diego",
        usuario: diego,
        servidor: "disponible",
      });
    });
  });

  describe("desde sin-usuario", () => {
    it("elegido → con-usuario con el elegido", () => {
      expect(reducirSesion(inexistente, { tipo: "elegido", usuario: lucia })).toEqual(conLucia);
    });

    it("validado y usuario-no-identificado no cambian nada (olvidar es idempotente)", () => {
      expect(
        reducirSesion(sinUsuario, {
          tipo: "validado",
          usuarioId: "usuario-lucia",
          decision: { tipo: "olvidar" },
        }),
      ).toBe(sinUsuario);
      expect(reducirSesion(sinUsuario, { tipo: "usuario-no-identificado", usuarioId: "usuario-lucia" })).toBe(
        sinUsuario,
      );
    });

    it("servidor-no-disponible no cambia nada", () => {
      expect(reducirSesion(sinUsuario, { tipo: "servidor-no-disponible" })).toBe(sinUsuario);
    });
  });
});
