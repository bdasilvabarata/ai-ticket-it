import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../../src/app";
import { ConflictoError, EntradaInvalidaError } from "../../src/errors/index";
import { traducirErrorPersistencia } from "../../src/repositories/errores-persistencia";
import { CategoriaModel } from "../../src/repositories/models/categoria.model";
import { EventoModel } from "../../src/repositories/models/evento.model";
import { UsuarioModel } from "../../src/repositories/models/usuario.model";
import type { RepositorioUsuarios } from "../../src/domain/repositorios";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

/** Ejecuta la operación y devuelve el error real que lanzó Mongo o Mongoose. */
async function capturar(operacion: () => Promise<unknown>): Promise<unknown> {
  try {
    await operacion();
  } catch (error) {
    return error;
  }
  throw new Error("La operación debía fallar.");
}

const errorDuplicado = async () => {
  await CategoriaModel.init();
  // "Música" ya existe en los datos de ejemplo.
  return capturar(() => CategoriaModel.create({ nombre: "Música", descripcion: "Repetida." }));
};

describe("traducirErrorPersistencia", () => {
  it("clave única duplicada (11000) → 409 RECURSO_DUPLICADO", async () => {
    const traducido = traducirErrorPersistencia(await errorDuplicado());
    expect(traducido).toBeInstanceOf(ConflictoError);
    expect(traducido).toMatchObject({ status: 409, codigo: "RECURSO_DUPLICADO" });
  });

  it("error de validación del modelo → 400 ENTRADA_INVALIDA con un detalle por campo, en español", async () => {
    const error = await capturar(() =>
      new EventoModel({ tiposEntrada: [{ nombre: "General", precio: 1.5, cupo: 10 }] }).validate(),
    );
    const traducido = traducirErrorPersistencia(error);
    expect(traducido).toBeInstanceOf(EntradaInvalidaError);
    const detalles = traducido?.detalles ?? [];
    expect(detalles.map((d) => d.campo)).toEqual(
      expect.arrayContaining(["nombre", "organizador", "tiposEntrada.0.precio"]),
    );
    expect(detalles.find((d) => d.campo === "nombre")?.mensaje).toBe("Es obligatorio.");
    expect(detalles.find((d) => d.campo === "tiposEntrada.0.precio")?.mensaje).toBe(
      "precio debe ser un número entero.",
    );
  });

  it("id con formato inválido (CastError) → 400 ENTRADA_INVALIDA", async () => {
    const traducido = traducirErrorPersistencia(await capturar(() => UsuarioModel.findById("xyz")));
    expect(traducido).toBeInstanceOf(EntradaInvalidaError);
    expect(traducido?.detalles).toEqual([{ campo: "_id", mensaje: "Tiene un formato inválido." }]);
  });

  it("cualquier otro error no se traduce", () => {
    expect(traducirErrorPersistencia(new Error("otra cosa"))).toBeUndefined();
    expect(traducirErrorPersistencia("no es un error")).toBeUndefined();
  });
});

describe("error handler con errores de persistencia", () => {
  it("responde 409 sin filtrar el detalle interno de Mongo", async () => {
    const duplicado = await errorDuplicado();
    const usuarios: RepositorioUsuarios = {
      listar: () => Promise.reject(duplicado),
      buscarPorId: () => Promise.reject(duplicado),
    };
    const app = crearApp({ almacenamiento: "memoria", repositorios: { usuarios } });
    const respuesta = await request(app).get("/api/usuarios");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("RECURSO_DUPLICADO");
    expect(respuesta.text).not.toContain("E11000");
  });
});
