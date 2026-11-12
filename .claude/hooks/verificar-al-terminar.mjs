// Hook `Stop` de Claude Code: antes de que el agente dé por terminado su turno, corre el typecheck
// y el lint de lo que cambió. Si fallan, sale con código 2 y le devuelve los errores al agente, que
// tiene que seguir hasta dejarlos en verde.
//
// - Compara cada archivo (sin contar los `.md`) con la última verificación exitosa y verifica solo
//   los paquetes afectados: `backend/` → backend; `mobile/` → mobile; `shared/` → los tres (backend y
//   mobile lo consumen); la config de la raíz (`eslint.config.js`, `tsconfig.base.json`,
//   `package.json`, `package-lock.json`) → todo. Otro `.js`/`.mjs`/`.cjs`/`.ts` de la raíz (como
//   este hook) → solo su lint. Si solo cambió Markdown, no corre nada.
// - `tsc --incremental` y `eslint --cache` (por contenido), con sus cachés en `node_modules/.cache/`.
//   El CI y `npm run typecheck`/`npm run lint` siguen corriendo sin caché.
// - Typecheck y lint corren en paralelo.
// - Bloquea una sola vez seguida: si el agente ya está continuando por este hook
//   (`stop_hook_active`) y sigue fallando, avisa sin bloquear para no entrar en un bucle.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const raiz = join(import.meta.dirname, "..", "..");
const cache = join(raiz, "node_modules", ".cache");
const archivoHuellas = join(cache, "claude-hooks", "ultima-verificacion.json");
const sinMarkdown = ["--", ".", ":(exclude)*.md"];

const paquetes = ["backend", "shared", "mobile"];
const configDeLaRaiz = new Set(["eslint.config.js", "tsconfig.base.json", "package.json", "package-lock.json"]);
const conLint = /\.(c|m)?(j|t)sx?$/;

const tsc = join(raiz, "node_modules", "typescript", "bin", "tsc");
const eslint = join(raiz, "node_modules", "eslint", "bin", "eslint.js");

function git(argumentos, input) {
  const resultado = spawnSync("git", argumentos, {
    cwd: raiz,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  return resultado.stdout ?? "";
}

const lista = (salida) => salida.split("\0").filter(Boolean);

/**
 * Huella de cada archivo que no es Markdown: el id de su blob en el índice de git o, si cambió
 * respecto de HEAD o es nuevo, el id que tendría su contenido actual (`git hash-object`, con los
 * mismos filtros de fin de línea). Así, commitear un archivo ya verificado no cambia su huella.
 */
function huellasDelArbol() {
  const huellas = {};
  for (const linea of lista(git(["ls-files", "--stage", "-z", ...sinMarkdown]))) {
    const tab = linea.indexOf("\t");
    huellas[linea.slice(tab + 1)] = linea.slice(0, tab).split(" ")[1];
  }
  const cambiados = [
    ...lista(git(["diff", "HEAD", "--name-only", "-z", ...sinMarkdown])),
    ...lista(git(["ls-files", "--others", "--exclude-standard", "-z", ...sinMarkdown])),
  ];
  const existentes = cambiados.filter((ruta) => existsSync(join(raiz, ruta)));
  for (const ruta of cambiados) huellas[ruta] = "borrado";
  if (existentes.length > 0) {
    const ids = git(["hash-object", "--stdin-paths"], existentes.join("\n")).trim().split("\n");
    existentes.forEach((ruta, i) => (huellas[ruta] = ids[i]));
  }
  return huellas;
}

function leerHuellas() {
  try {
    return JSON.parse(readFileSync(archivoHuellas, "utf8"));
  } catch {
    return null;
  }
}

/** Qué verificar según los archivos cambiados. */
function verificacionesPara(cambiados) {
  const tipos = new Set();
  const lint = new Set();
  for (const ruta of cambiados) {
    const paquete = paquetes.find((nombre) => ruta.startsWith(`${nombre}/`));
    if (paquete === "shared") {
      paquetes.forEach((nombre) => (tipos.add(nombre), lint.add(nombre)));
    } else if (paquete) {
      tipos.add(paquete);
      lint.add(paquete);
    } else if (configDeLaRaiz.has(ruta)) {
      paquetes.forEach((nombre) => tipos.add(nombre));
      lint.add(".");
    } else if (conLint.test(ruta) && existsSync(join(raiz, ruta))) {
      lint.add(ruta);
    }
  }
  return { tipos: paquetes.filter((nombre) => tipos.has(nombre)), lint: lint.has(".") ? ["."] : [...lint] };
}

function correr(argumentos) {
  return new Promise((resolver) => {
    const hijo = spawn(process.execPath, argumentos, { cwd: raiz });
    let salida = "";
    hijo.stdout.on("data", (parte) => (salida += parte));
    hijo.stderr.on("data", (parte) => (salida += parte));
    hijo.on("error", (error) => resolver({ status: 1, salida: String(error) }));
    hijo.on("close", (status) => resolver({ status, salida }));
  });
}

/** Las rutas tipadas solo dependen de los archivos de `mobile/app/`: se regeneran si cambió alguno. */
function hayQueGenerarRutas(cambiados) {
  return (
    !existsSync(join(raiz, "mobile", ".expo", "types", "router.d.ts")) ||
    cambiados.some((ruta) => ruta.startsWith("mobile/app/") || !ruta.includes("/"))
  );
}

async function typecheck(paquete, cambiados) {
  if (paquete === "mobile" && hayQueGenerarRutas(cambiados)) {
    const rutas = await correr([join(raiz, "mobile", "scripts", "generar-tipos-rutas.js")]);
    if (rutas.status !== 0) return rutas;
  }
  const buildInfo = join(cache, "tsc", `${paquete}.tsbuildinfo`);
  return correr([tsc, "-p", paquete, "--noEmit", "--incremental", "--tsBuildInfoFile", buildInfo, "--pretty", "false"]);
}

function lint(objetivos) {
  const ubicacion = join(cache, "eslint") + "/";
  return correr([eslint, "--cache", "--cache-strategy", "content", "--cache-location", ubicacion, ...objetivos]);
}

let entrada = {};
try {
  entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // Sin entrada válida: se verifica igual.
}

const huellas = huellasDelArbol();
const anteriores = leerHuellas();
const rutas = new Set([...Object.keys(huellas), ...Object.keys(anteriores ?? {})]);
const cambiados = anteriores ? [...rutas].filter((ruta) => huellas[ruta] !== anteriores[ruta]) : [...configDeLaRaiz];
const { tipos, lint: objetivosDeLint } = verificacionesPara(cambiados);

const tareas = [
  ...tipos.map((paquete) => ({ nombre: `typecheck de ${paquete}`, resultado: typecheck(paquete, cambiados) })),
  ...(objetivosDeLint.length > 0
    ? [{ nombre: `lint de ${objetivosDeLint.join(", ")}`, resultado: lint(objetivosDeLint) }]
    : []),
];

const fallas = [];
for (const { nombre, resultado } of tareas) {
  const { status, salida } = await resultado;
  if (status !== 0) fallas.push(`${nombre} falló:\n${salida.trim().split("\n").slice(-60).join("\n")}`);
}

if (fallas.length === 0) {
  mkdirSync(dirname(archivoHuellas), { recursive: true });
  writeFileSync(archivoHuellas, JSON.stringify(huellas));
  process.exit(0);
}

const detalle = fallas.join("\n\n");
if (entrada.stop_hook_active) {
  console.log(
    JSON.stringify({ systemMessage: `Typecheck/lint siguen fallando después de un reintento.\n\n${detalle}` }),
  );
  process.exit(0);
}
console.error(`Antes de terminar, corregí estos errores (typecheck y lint tienen que quedar en verde):\n\n${detalle}`);
process.exit(2);
