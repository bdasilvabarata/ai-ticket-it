/** Interfaz mínima de AsyncStorage que usa la app (R6). */
export interface Almacenamiento {
  getItem(clave: string): Promise<string | null>;
  setItem(clave: string, valor: string): Promise<void>;
  removeItem(clave: string): Promise<void>;
}

export interface RepositorioUsuarioRecordado {
  /** El id recordado, o `null` si no hay o lo guardado no sirve. Nunca lanza. */
  leer(): Promise<string | null>;
  guardar(usuarioId: string): Promise<void>;
  olvidar(): Promise<void>;
}

export const CLAVE_USUARIO_RECORDADO = "ai-ticket-it/usuario-recordado";
const VERSION = 1;

interface ValorGuardado {
  version: typeof VERSION;
  usuarioId: string;
}

function esValorGuardado(valor: unknown): valor is ValorGuardado {
  if (typeof valor !== "object" || valor === null) return false;
  const { version, usuarioId } = valor as Record<string, unknown>;
  return version === VERSION && typeof usuarioId === "string" && usuarioId.length > 0;
}

export function crearRepositorioUsuarioRecordado(
  almacenamiento: Almacenamiento,
): RepositorioUsuarioRecordado {
  async function descartar(): Promise<null> {
    try {
      await almacenamiento.removeItem(CLAVE_USUARIO_RECORDADO);
    } catch {
      // Si tampoco se puede borrar, alcanza con no usarlo.
    }
    return null;
  }

  return {
    async leer() {
      let texto: string | null;
      try {
        texto = await almacenamiento.getItem(CLAVE_USUARIO_RECORDADO);
      } catch {
        return descartar();
      }
      if (texto === null) return null;
      try {
        const valor: unknown = JSON.parse(texto);
        return esValorGuardado(valor) ? valor.usuarioId : descartar();
      } catch {
        return descartar();
      }
    },
    async guardar(usuarioId) {
      const valor: ValorGuardado = { version: VERSION, usuarioId };
      await almacenamiento.setItem(CLAVE_USUARIO_RECORDADO, JSON.stringify(valor));
    },
    async olvidar() {
      await almacenamiento.removeItem(CLAVE_USUARIO_RECORDADO);
    },
  };
}
