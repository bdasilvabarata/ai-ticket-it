/** @jest-environment node */
/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reglas de dependencia de mobile (research R1 y R4, contracts/estructura.md "Reglas"). Corre ESLint
 * de verdad sobre código que rompe cada regla: si el resolver o las zonas estuvieran mal
 * configurados, el lint pasaría sin ver nada y este test lo detecta.
 */

const RAIZ = path.resolve(__dirname, "../../..");
const ESLINT = path.join(RAIZ, "node_modules/eslint/bin/eslint.js");

interface ResultadoEslint {
  filePath: string;
  messages: { ruleId: string | null; message: string }[];
}

function correrEslint(argumentos: string[], entrada?: string): ResultadoEslint[] {
  try {
    const salida = execFileSync(process.execPath, [ESLINT, ...argumentos, "--format", "json"], {
      cwd: RAIZ,
      input: entrada,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(salida) as ResultadoEslint[];
  } catch (error) {
    // Exit code 1 = hay errores de lint: la salida JSON sigue siendo válida.
    const { status, stdout } = error as { status?: number; stdout?: string };
    if (status === 1 && stdout) return JSON.parse(stdout) as ResultadoEslint[];
    throw error;
  }
}

/** Lintea `codigo` como si fuera el archivo `ruta` (relativa a la raíz) y devuelve las reglas que fallan. */
function lintear(ruta: string, codigo: string): (string | null)[] {
  return correrEslint(["--stdin", "--stdin-filename", ruta], codigo).flatMap((resultado) =>
    resultado.messages.map((mensaje) => mensaje.ruleId),
  );
}

function leer(ruta: string): string {
  return readFileSync(path.join(RAIZ, ruta), "utf8");
}

jest.setTimeout(60_000);

describe("reglas de dependencia de mobile (FR-008, FR-010)", () => {
  it("(a) regla 1: un ciclo entre módulos falla con import-x/no-cycle", () => {
    const codigo = `${leer("mobile/src/api/errores.ts")}\nimport "./cliente";\n`;

    expect(lintear("mobile/src/api/errores.ts", codigo)).toContain("import-x/no-cycle");
  });

  it("(e) el código real no tiene errores de lint", () => {
    const resultados = correrEslint(["mobile"]);
    const errores = resultados.flatMap((resultado) =>
      resultado.messages.map((mensaje) => `${resultado.filePath}: ${mensaje.ruleId} ${mensaje.message}`),
    );

    expect(errores).toEqual([]);
  });
});
