import { destinoMongo } from "../config/destino-mongo";

const FLAG_FORZAR = "--forzar";

export type PlanSeed = { accion: "abortar"; mensaje: string } | { accion: "cargar"; destino: string };

/** Decide si `npm run seed` puede cargar datos. Sin `--forzar` no toca nada (FR-007). */
export function planificarSeed(argv: string[], mongoUri: string | undefined): PlanSeed {
  if (!mongoUri) {
    return {
      accion: "abortar",
      mensaje:
        "Falta MONGO_URI. El comando seed carga datos en una base real: definí MONGO_URI en " +
        "backend/.env (sin ella, `npm start` ya usa MongoDB en memoria con datos de ejemplo).",
    };
  }
  const { host, base } = destinoMongo(mongoUri);
  const destino = base ? `${host}/${base}` : host;
  if (!argv.includes(FLAG_FORZAR)) {
    return {
      accion: "abortar",
      mensaje:
        `No se modificó nada. Destino: base "${base || "(por defecto)"}" en ${host}.\n` +
        "El seed VACÍA las colecciones categorias, usuarios y eventos y carga los datos de " +
        "ejemplo.\nPara confirmar, corré: npm run seed -- --forzar",
    };
  }
  return { accion: "cargar", destino };
}

export interface DependenciasSeed {
  argv: string[];
  mongoUri: string | undefined;
  conectar: (uri: string) => Promise<unknown>;
  cargar: () => Promise<{ categorias: number; usuarios: number; eventos: number }>;
  desconectar: () => Promise<unknown>;
  escribir: (mensaje: string) => void;
  escribirError: (mensaje: string) => void;
}

/** Orquesta el comando seed con dependencias inyectadas. Devuelve el código de salida. */
export async function ejecutarSeed(deps: DependenciasSeed): Promise<number> {
  const plan = planificarSeed(deps.argv, deps.mongoUri);
  if (plan.accion === "abortar" || !deps.mongoUri) {
    deps.escribirError(plan.accion === "abortar" ? plan.mensaje : "Falta MONGO_URI.");
    return 1;
  }
  try {
    await deps.conectar(deps.mongoUri);
    const resumen = await deps.cargar();
    deps.escribir(
      `Se cargaron ${resumen.categorias} categorías, ${resumen.usuarios} usuarios y ` +
        `${resumen.eventos} eventos en ${plan.destino}.`,
    );
    return 0;
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    deps.escribirError(`No se pudieron cargar los datos de ejemplo en ${plan.destino}: ${detalle}`);
    return 1;
  } finally {
    await deps.desconectar();
  }
}
