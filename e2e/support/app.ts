import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { chromium, type Browser, type Page } from "@playwright/test";
import { encerrarWebviewsDoTeste, limparDadosDeTeste, webviewsDoTeste } from "./dados";

export const PORTA_CDP = 9333;
const EXE = resolve(process.cwd(), "src-tauri", "target", "debug", "cstm.exe");

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperarPorta(porta: number, limiteMs: number): Promise<void> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (resposta.ok) return;
    } catch {
      // ainda não abriu
    }
    await esperar(200);
  }
  throw new Error(`A porta CDP ${porta} não abriu em ${limiteMs} ms.`);
}

async function portaLivre(porta: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${porta}/json/version`);
    return false;
  } catch {
    return true;
  }
}

/** O processo existe? (kill com sinal 0 só testa; EPERM também quer dizer que existe.) */
function pidVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return (erro as NodeJS.ErrnoException).code === "EPERM";
  }
}

function webviewsRestantes(): number {
  try {
    return webviewsDoTeste().length;
  } catch {
    return 0;
  }
}

export class AppDeTeste {
  private processo?: ChildProcess;
  private browser?: Browser;
  /** Instante (Date.now) em que o processo atual foi lançado. */
  iniciadoEm = 0;
  /** Configuração de atualizações que o app tinha ao abrir, antes de o suporte a desligar. */
  atualizacoesAoAbrir?: { enabled: boolean; intervalDays: number };

  /** Abre o build de teste; `limpar` apaga antes as pastas de dados de teste. */
  async iniciar(limpar: boolean): Promise<void> {
    if (!existsSync(EXE)) throw new Error(`Build de teste não encontrado: ${EXE}. Rode npm run e2e:build.`);
    if (!(await portaLivre(PORTA_CDP))) throw new Error(`A porta ${PORTA_CDP} já está em uso.`);
    if (limpar) limparDadosDeTeste();
    this.iniciadoEm = Date.now();
    this.processo = spawn(EXE, [], {
      env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORTA_CDP}` },
      stdio: "ignore",
    });
    try {
      await esperarPorta(PORTA_CDP, 30_000);
      this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORTA_CDP}`);
      await this.desligarAtualizacoes();
    } catch (erro) {
      await this.encerrar();
      throw erro;
    }
  }

  /**
   * O app consulta o GitHub 10 s depois de abrir quando nunca verificou: desliga a verificação pelo
   * comando do próprio app, para nenhum teste fazer requisição de rede.
   */
  private async desligarAtualizacoes(): Promise<void> {
    const main = await this.esperarPagina(false);
    await main.waitForFunction(() => "__TAURI_INTERNALS__" in window);
    // Guarda o que o banco tinha (o intervalo escolhido segue valendo; só a verificação é desligada).
    this.atualizacoesAoAbrir = await main.evaluate(async () => {
      const invocar = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a?: object) => Promise<unknown> } })
        .__TAURI_INTERNALS__.invoke;
      const antes = (await invocar("get_update_settings")) as { enabled: boolean; intervalDays: number };
      await invocar("set_update_settings", { enabled: false, intervalDays: antes.intervalDays });
      return antes;
    });
  }

  /** O processo lançado ainda está rodando? */
  vivo(): boolean {
    return this.processo !== undefined && this.processo.exitCode === null && this.processo.signalCode === null;
  }

  /** PID do processo lançado. */
  get pid(): number {
    if (!this.processo?.pid) throw new Error("O app de teste não está rodando.");
    return this.processo.pid;
  }

  /**
   * O app faz a primeira consulta de atualização 10 s depois de abrir (se ligada e vencida). Espera
   * passar dessa marca, para ligar a opção numa tela sem risco de uma requisição de rede.
   */
  async esperarPassarDaPrimeiraVerificacao(): Promise<void> {
    const falta = this.iniciadoEm + 12_000 - Date.now();
    if (falta > 0) await esperar(falta);
  }

  /** Todas as páginas do WebView2 (as janelas do app). */
  paginas(): Page[] {
    return this.browser?.contexts().flatMap((c) => c.pages()) ?? [];
  }

  private async esperarPagina(ehPicker: boolean, limiteMs = 15_000): Promise<Page> {
    const fim = Date.now() + limiteMs;
    while (Date.now() < fim) {
      const pagina = this.paginas().find((p) => new URL(p.url()).pathname.endsWith("picker.html") === ehPicker);
      if (pagina) return pagina;
      await esperar(200);
    }
    throw new Error(`Página ${ehPicker ? "picker" : "main"} não apareceu em ${limiteMs} ms.`);
  }

  /** Janela de cadastro: no WebView2 a página principal tem URL http://tauri.localhost/ (sem index.html). */
  main(): Promise<Page> {
    return this.esperarPagina(false);
  }

  /** Janela do menu de colagem (picker.html); é criada oculta e pode demorar a existir. */
  picker(limiteMs?: number): Promise<Page> {
    return this.esperarPagina(true, limiteMs);
  }

  /** Encerra só o processo lançado (por PID, com os filhos do WebView2); nunca o CSTM instalado. */
  async encerrar(): Promise<void> {
    const pid = this.processo?.pid;
    const browser = this.browser;
    this.browser = undefined;
    this.processo = undefined;
    if (browser) await browser.close().catch(() => undefined);
    if (pid) {
      // /T mata a árvore que existe nesse instante; /F não espera o fim. Depois: espera o PID sumir, caça os msedgewebview2.exe
      // do teste que ficaram órfãos (seguram a pasta de dados) e espera a porta CDP livre.
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      const fimDoPid = Date.now() + 5_000;
      while (Date.now() < fimDoPid && pidVivo(pid)) await esperar(100);
      encerrarWebviewsDoTeste();
      const fimDosWebviews = Date.now() + 5_000;
      while (Date.now() < fimDosWebviews && webviewsRestantes() > 0) await esperar(200);
      const fim = Date.now() + 10_000;
      while (Date.now() < fim && !(await portaLivre(PORTA_CDP))) await esperar(200);
    }
  }

  /**
   * Fecha o app pelo comando de sair (grava a posição da janela, como o "Sair" da bandeja) e reabre
   * mantendo as pastas de dados. Se o processo não sair em 10 s, cai no encerramento forçado.
   */
  async reiniciar(): Promise<void> {
    const processo = this.processo;
    if (processo && this.browser) {
      const saiu = new Promise<boolean>((resolver) => {
        if (processo.exitCode !== null) resolver(true);
        processo.once("exit", () => resolver(true));
        setTimeout(() => resolver(false), 10_000);
      });
      const main = await this.main();
      // A página some junto com o processo, então a chamada pode nem responder.
      void main
        .evaluate(() =>
          (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string) => Promise<unknown> } })
            .__TAURI_INTERNALS__.invoke("exit_app"),
        )
        .catch(() => undefined);
      await saiu;
    }
    await this.encerrar();
    await this.iniciar(false);
  }
}
