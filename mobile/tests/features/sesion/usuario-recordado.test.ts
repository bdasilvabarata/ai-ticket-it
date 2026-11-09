import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  crearRepositorioUsuarioRecordado,
  type Almacenamiento,
} from "../../../src/features/sesion/usuario-recordado";

const CLAVE = "ai-ticket-it/usuario-recordado";

describe("repositorio del usuario recordado", () => {
  const repositorio = crearRepositorioUsuarioRecordado(AsyncStorage);

  it("guardar escribe el JSON versionado y leer lo devuelve", async () => {
    await repositorio.guardar("usuario-lucia");

    expect(JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? "null")).toEqual({
      version: 1,
      usuarioId: "usuario-lucia",
    });
    await expect(repositorio.leer()).resolves.toBe("usuario-lucia");
  });

  it("sin clave devuelve null", async () => {
    await expect(repositorio.leer()).resolves.toBeNull();
  });

  it.each([
    ["JSON inválido", "{no es json"],
    ["otra versión", JSON.stringify({ version: 2, usuarioId: "usuario-lucia" })],
    ["usuarioId vacío", JSON.stringify({ version: 1, usuarioId: "" })],
    ["usuarioId no string", JSON.stringify({ version: 1, usuarioId: 7 })],
    ["un valor que no es objeto", JSON.stringify("usuario-lucia")],
  ])("con %s devuelve null y borra la clave", async (_caso, valor) => {
    await AsyncStorage.setItem(CLAVE, valor);

    await expect(repositorio.leer()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(CLAVE)).resolves.toBeNull();
  });

  it("si getItem rechaza devuelve null, sin lanzar, y borra la clave", async () => {
    const removeItem = jest.fn(async () => {});
    const almacenamiento: Almacenamiento = {
      getItem: async () => {
        throw new Error("disco roto");
      },
      setItem: async () => {},
      removeItem,
    };

    await expect(crearRepositorioUsuarioRecordado(almacenamiento).leer()).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith(CLAVE);
  });

  it("olvidar borra la clave", async () => {
    await repositorio.guardar("usuario-lucia");
    await repositorio.olvidar();

    await expect(AsyncStorage.getItem(CLAVE)).resolves.toBeNull();
  });
});
