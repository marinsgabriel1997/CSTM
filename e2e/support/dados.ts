import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { powershell } from "./windows/powershell";

export const IDENTIFICADOR_TESTE = "com.gabriel.cstm.teste";

/** Pastas de dados do build de teste (nunca as do CSTM instalado, com.gabriel.cstm). */
export function pastasDeDadosDeTeste(): string[] {
  const bases = [process.env.APPDATA, process.env.LOCALAPPDATA];
  return bases.map((base) => {
    if (!base) throw new Error("APPDATA ou LOCALAPPDATA não definido.");
    return join(base, IDENTIFICADOR_TESTE);
  });
}

const dormir = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * PIDs dos msedgewebview2.exe do app de teste: os que têm o identificador de teste na linha de comando (o --user-data-dir do
 * WebView2 fica dentro da pasta de dados). Os do CSTM instalado usam com.gabriel.cstm (sem ".teste") e não casam.
 */
export function webviewsDoTeste(): number[] {
  const saida = powershell(
    `$p = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like '*${IDENTIFICADOR_TESTE}*' } | ForEach-Object { $_.ProcessId }); if ($p.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject $p -Compress }`,
  ).trim();
  return JSON.parse(saida || "[]") as number[];
}

/** Encerra os WebView2 que sobraram do app de teste (só os do identificador de teste) e devolve quantos eram. */
export function encerrarWebviewsDoTeste(): number {
  let pids: number[];
  try {
    pids = webviewsDoTeste();
  } catch {
    return 0;
  }
  for (const pid of pids) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  return pids.length;
}

/**
 * Apaga somente as pastas de dados do identificador de teste; recusa qualquer outro caminho. Tenta de novo por ~8 s em
 * EPERM/EBUSY/ENOTEMPTY (o app e o WebView2 do teste anterior ainda podem estar soltando arquivos, ou o antivírus/indexador
 * estar lendo a pasta). Depois da primeira falha, encerra os WebView2 de teste que sobraram. Se ainda falhar, o erro diz o que
 * continuava preso.
 */
export function limparDadosDeTeste(): void {
  for (const pasta of pastasDeDadosDeTeste()) {
    const nome = pasta.split(/[\\/]/).pop();
    if (nome !== IDENTIFICADOR_TESTE) {
      throw new Error(`Recusado: ${pasta} não termina em ${IDENTIFICADOR_TESTE}.`);
    }
    if (!existsSync(pasta)) continue;
    const fim = Date.now() + 8_000;
    let matou = false;
    let ultimo: unknown;
    for (;;) {
      try {
        rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        ultimo = undefined;
        break;
      } catch (erro) {
        ultimo = erro;
        const codigo = (erro as NodeJS.ErrnoException).code;
        if (codigo !== "EPERM" && codigo !== "EBUSY" && codigo !== "ENOTEMPTY") break;
        if (!matou) {
          matou = true;
          encerrarWebviewsDoTeste();
        }
        if (Date.now() >= fim) break;
        dormir(300);
      }
    }
    if (ultimo !== undefined) {
      let presos = "(não consegui listar)";
      try {
        const webviews = webviewsDoTeste();
        presos = webviews.length > 0 ? `msedgewebview2.exe do teste ainda vivos: ${webviews.join(", ")}` : "nenhum msedgewebview2.exe do teste vivo (outro programa, como antivírus ou indexador, deve estar segurando a pasta)";
      } catch {
        // só diagnóstico
      }
      throw new Error(`Não consegui apagar ${pasta} em 8 s: ${String(ultimo)}. ${presos}.`, { cause: ultimo });
    }
  }
}
