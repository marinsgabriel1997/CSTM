import { spawnSync } from "node:child_process";

/** Escreve e roda um trecho de PowerShell (codificado, sem problemas de aspas) e devolve a saída. */
export function powershell(script: string): string {
  const codificado = Buffer.from(script, "utf16le").toString("base64");
  const resultado = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", codificado], {
    encoding: "utf8",
  });
  if (resultado.status !== 0) {
    const motivo = resultado.stderr || resultado.stdout || resultado.error?.message || `código ${resultado.status}, sinal ${resultado.signal}`;
    throw new Error(`PowerShell falhou: ${motivo}`);
  }
  return resultado.stdout;
}
