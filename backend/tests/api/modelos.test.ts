import mongoose, { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { CategoriaModel } from "../../src/repositories/models/categoria.model";
import { EventoModel } from "../../src/repositories/models/evento.model";
import { UsuarioModel } from "../../src/repositories/models/usuario.model";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba({ sembrar: false });

beforeAll(async () => {
  await CategoriaModel.init();
});

function eventoValido() {
  return {
    nombre: "Recital",
    descripcion: "Un recital",
    categoria: new Types.ObjectId(),
    fechaHora: new Date("2027-01-01T00:00:00Z"),
    organizador: new Types.ObjectId(),
    tiposEntrada: [{ nombre: "General", precio: 1000, cupo: 10 }],
  };
}

function conTipo(cambios: Record<string, unknown>) {
  const evento = eventoValido();
  return { ...evento, tiposEntrada: [{ ...evento.tiposEntrada[0], ...cambios }] };
}

describe("EventoModel", () => {
  it("guarda un evento válido sin __v y con _id en cada tipo de entrada", async () => {
    const creado = await EventoModel.create(eventoValido());
    const crudo = await mongoose.connection.collection("eventos").findOne({ _id: creado._id });
    expect(crudo).not.toBeNull();
    expect(crudo).not.toHaveProperty("__v");
    expect(crudo?.tiposEntrada[0]._id).toBeInstanceOf(Types.ObjectId);
  });

  it.each<[string, object]>([
    ["precio decimal", conTipo({ precio: 1.5 })],
    ["precio negativo", conTipo({ precio: -1 })],
    ["cupo negativo", conTipo({ cupo: -1 })],
    ["cupo decimal", conTipo({ cupo: 2.5 })],
    ["sin tipos de entrada", { ...eventoValido(), tiposEntrada: [] }],
    ["sin categoría", { ...eventoValido(), categoria: undefined }],
    ["sin organizador", { ...eventoValido(), organizador: undefined }],
  ])("rechaza un evento con %s", async (_caso, evento) => {
    await expect(EventoModel.create(evento)).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });
});

describe("CategoriaModel", () => {
  it("no admite dos categorías con el mismo nombre", async () => {
    await CategoriaModel.create({ nombre: "Música", descripcion: "Primera" });
    await expect(CategoriaModel.create({ nombre: "Música", descripcion: "Duplicada" })).rejects.toMatchObject(
      { code: 11000 },
    );
  });
});

describe("UsuarioModel", () => {
  it("exige nombre", async () => {
    await expect(UsuarioModel.create({ apellido: "Pérez" })).rejects.toBeInstanceOf(
      mongoose.Error.ValidationError,
    );
  });

  it("recorta los espacios del nombre", async () => {
    const usuario = await UsuarioModel.create({ nombre: "  Ana  ", apellido: "Pérez" });
    expect(usuario.nombre).toBe("Ana");
  });
});
