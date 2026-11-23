import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { powershell } from "./powershell";

/**
 * O CSTM instalado do usuário (%LOCALAPPDATA%\CSTM\cstm.exe) ocupa o Alt+Q e a instância única. O projeto "windows"
 * o fecha durante a execução e o reabre no fim. Distingue-o do build de teste pelo caminho do executável.
 */

/** Argumento com que o Windows inicia o CSTM ao entrar na sessão (src-tauri/src/autostart.rs): só na bandeja. */
export const ARGUMENTO_DO_LOGIN = "--autostart";

export interface ProcessoCstm {
  pid: number;
  caminho: string | null;
}

/** Executável do build de teste (src-tauri/target/debug/cstm.exe), o mesmo de app.ts. */
export function caminhoDoBuildDeTeste(): string {
  return resolve(process.cwd(), "src-tauri", "target", "debug", "cstm.exe");
}

const normalizar = (caminho: string) => resolve(caminho).toLowerCase();

const dormirSincrono = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Todos os processos cstm.exe, com o caminho do executável (WMI lê também os de outro nível de acesso). Tenta de novo se o PowerShell falhar (processo morto no meio, WMI ocupado). */
export function listarProcessosCstm(): ProcessoCstm[] {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return listarProcessosCstmUmaVez();
    } catch (erro) {
      ultimo = erro;
      dormirSincrono(500);
    }
  }
  throw ultimo;
}

function listarProcessosCstmUmaVez(): ProcessoCstm[] {
  const saida = powershell(
    "$p = @(Get-CimInstance Win32_Process -Filter \"Name='cstm.exe'\" | Select-Object ProcessId, ExecutablePath); if ($p.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject $p -Compress }",
  ).trim();
  const lista = JSON.parse(saida || "[]") as { ProcessId: number; ExecutablePath: string | null }[];
  return lista.map((p) => ({ pid: p.ProcessId, caminho: p.ExecutablePath }));
}

/** O CSTM instalado em execução; um cstm.exe de caminho ilegível é tratado como instalado (o mais seguro: não mexer no teste). */
export function listarInstalados(): ProcessoCstm[] {
  const teste = normalizar(caminhoDoBuildDeTeste());
  return listarProcessosCstm().filter((p) => p.caminho === null || normalizar(p.caminho) !== teste);
}

/** Processos do build de teste (que a camada do Windows pode encerrar sem risco). */
export function listarDoBuildDeTeste(): ProcessoCstm[] {
  const teste = normalizar(caminhoDoBuildDeTeste());
  return listarProcessosCstm().filter((p) => p.caminho !== null && normalizar(p.caminho) === teste);
}

/** Encerra o processo pelo PID, com os filhos do WebView2 (o fechamento normal só oculta a janela, e o app fica na bandeja). */
export function encerrarPorPid(pid: number): void {
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera nenhum dos PIDs estar mais em execução. */
export async function esperarSairem(pids: number[], limiteMs = 15_000): Promise<boolean> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const vivos = listarProcessosCstm().filter((p) => pids.includes(p.pid));
    if (vivos.length === 0) return true;
    await esperar(300);
  }
  return false;
}

/**
 * Abre o CSTM como o Windows o abre no login (caminho completo e "--autostart": só a bandeja, janela oculta), solto do
 * processo atual para sobreviver a ele. Devolve o PID depois de confirmar que o processo ficou em execução.
 */
export async function reabrirComoNoLogin(caminho: string): Promise<number | null> {
  const filho = spawn(caminho, [ARGUMENTO_DO_LOGIN], { detached: true, stdio: "ignore", cwd: dirname(caminho) });
  filho.unref();
  const fim = Date.now() + 15_000;
  while (Date.now() < fim) {
    await esperar(400);
    const achado = listarInstalados().find((p) => p.caminho !== null && normalizar(p.caminho) === normalizar(caminho));
    if (achado) return achado.pid;
  }
  return null;
}
