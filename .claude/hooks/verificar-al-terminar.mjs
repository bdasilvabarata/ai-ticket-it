// Hook `Stop` de Claude Code: antes de que el agente dé por terminado su turno, corre
// `npm run typecheck` y `npm run lint`. Si fallan, sale con código 2 y le devuelve los errores
// al agente, que tiene que seguir hasta dejarlos en verde.
//
// - Solo corre si cambió algo que no sea Markdown desde la última verificación exitosa
//   (las etapas de spec/plan/tasks no lo disparan).
// - Bloquea una sola vez seguida: si el agente ya está continuando por este hook
//   (`stop_hook_active`) y sigue fallando, avisa sin bloquear para no entrar en un bucle.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const raiz = join(import.meta.dirname, "..", "..");
const archivoHuella = join(raiz, "node_modules", ".cache", "claude-hooks", "ultima-verificacion.txt");
const sinMarkdown = ["--", ".", ":(exclude)*.md"];

function correr(comando, argumentos) {
  return spawnSync(comando, argumentos, { cwd: raiz, encoding: "utf8", shell: process.platform === "win32" });
}

function git(...argumentos) {
  return correr("git", argumentos).stdout ?? "";
}

function huellaDelArbol() {
  const hash = createHash("sha256");
  hash.update(git("rev-parse", "HEAD"));
  hash.update(git("diff", "HEAD", ...sinMarkdown));
  for (const archivo of git("ls-files", "--others", "--exclude-standard", ...sinMarkdown).split("\n")) {
    if (!archivo) continue;
    try {
      hash.update(`${archivo}:${statSync(join(raiz, archivo)).mtimeMs}`);
    } catch {
      hash.update(archivo);
    }
  }
  return hash.digest("hex");
}

function leer(ruta) {
  try {
    return readFileSync(ruta, "utf8");
  } catch {
    return "";
  }
}

let entrada = {};
try {
  entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // Sin entrada válida: se verifica igual.
}

const huella = huellaDelArbol();
if (leer(archivoHuella) === huella) process.exit(0);

const fallas = [];
for (const script of ["typecheck", "lint"]) {
  const resultado = correr("npm", ["run", script, "--silent"]);
  if (resultado.status !== 0) {
    const salida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`.trim().split("\n").slice(-60).join("\n");
    fallas.push(`npm run ${script} falló:\n${salida}`);
  }
}

if (fallas.length === 0) {
  mkdirSync(dirname(archivoHuella), { recursive: true });
  writeFileSync(archivoHuella, huella);
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
