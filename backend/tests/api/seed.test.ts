import mongoose, { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { cargarSeed } from "../../src/seed/cargar-seed";
import { crearDatosEjemplo } from "../../src/seed/datos-ejemplo";
import { usarBaseDePrueba } from "./helpers/base-de-prueba";

usarBaseDePrueba();

const esperados = crearDatosEjemplo(new Date());

async function idsDe(nombre: string): Promise<string[]> {
  const documentos = await mongoose.connection.collection(nombre).find().toArray();
  return documentos.map((documento) => String(documento._id)).sort();
}

async function verificarContenido(): Promise<void> {
  expect(await idsDe("categorias")).toEqual(esperados.categorias.map((c) => c.id).sort());
  expect(await idsDe("usuarios")).toEqual(esperados.usuarios.map((u) => u.id).sort());
  expect(await idsDe("eventos")).toEqual(esperados.eventos.map((e) => e.id).sort());
}

describe("cargarSeed", () => {
  it("carga 6 categorías, 5 usuarios y 8 eventos con los ids fijos", async () => {
    await verificarContenido();
  });

  it("no duplica al correrse dos veces", async () => {
    await cargarSeed();
    await cargarSeed();
    await verificarContenido();
  });

  it("borra lo que no es parte de los datos de ejemplo", async () => {
    await mongoose.connection
      .collection("usuarios")
      .insertOne({ _id: new Types.ObjectId(), nombre: "Extra", apellido: "Usuario", favoritos: [] });
    await mongoose.connection
      .collection("categorias")
      .insertOne({ _id: new Types.ObjectId(), nombre: "Extra", descripcion: "Extra" });
    await cargarSeed();
    await verificarContenido();
  });

  it("no guarda __v", async () => {
    for (const nombre of ["categorias", "usuarios", "eventos"]) {
      const documentos = await mongoose.connection.collection(nombre).find().toArray();
      for (const documento of documentos) expect(documento).not.toHaveProperty("__v");
    }
  });
});
