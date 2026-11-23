import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/** Horário local com milissegundos, para o registro dos passos do teste do Windows. */
export function hora(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function registrar(mensagem: string): void {
  console.log(`[${hora()}] ${mensagem}`);
}

/** Pasta dos arquivos de estado e registro da camada do Windows (e2e/.resultados/windows, ignorada pelo git). */
export function pastaDoWindows(): string {
  const pasta = resolve(process.cwd(), "e2e", ".resultados", "windows");
  mkdirSync(pasta, { recursive: true });
  return pasta;
}

export function arquivoDoWindows(nome: string): string {
  return resolve(pastaDoWindows(), nome);
}
