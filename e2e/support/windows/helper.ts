import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * Cliente do helper do Windows (Helper.cs, carregado por helper.ps1): um PowerShell persistente que recebe um comando
 * JSON por linha na entrada padrão e responde uma linha JSON na saída. Usa teclado, mouse e clipboard REAIS: só deve
 * ser criado pelo projeto "windows" (npm run test:windows), nunca pela camada do app.
 */

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface JanelaInfo {
  hwnd: number;
  pid: number;
  titulo: string;
  classe: string;
  visivel: boolean;
  minimizada: boolean;
  primeiroPlano: boolean;
  retangulo: Retangulo;
}

export interface PosicaoDoAlvo {
  hwnd: number;
  pid: number;
  titulo: string;
  retangulo: Retangulo;
  /** Área da caixa de texto, em pixels físicos da tela. */
  caixa: Retangulo;
  emPrimeiroPlano: boolean;
}

export interface FormatoSalvo {
  id: number;
  nome: string;
  /** Bytes em base64. */
  dados: string;
}

/** Resumo do clipboard sem conteúdo: só formatos, tamanhos, dimensões e hash de cada formato. */
export interface ResumoDoClipboard {
  sequencia: number;
  formatos: string[];
  hashes: Record<string, string>;
  texto: { caracteres: number } | null;
  html: boolean;
  rtf: boolean;
  sensivel: boolean;
  imagem: { formato: "png" | "dib"; largura: number; altura: number } | null;
}

export interface EscritaDoClipboard {
  texto?: string;
  /** Fragmento HTML; o helper monta o cabeçalho "HTML Format". */
  html?: string;
  /** Conteúdo completo do formato "HTML Format" (com cabeçalho), sem alteração. */
  htmlBruto?: string;
  rtf?: string;
  imagem?: {
    largura?: number;
    altura?: number;
    /** Cor de fundo (#RRGGBB) da imagem gerada. */
    cor?: string;
    /** PNG existente, em base64 (no lugar da imagem gerada). */
    pngBase64?: string;
    /** Formatos gravados; padrão: dib e png. */
    formatos?: ("dib" | "png")[];
  };
  /** Marca com ExcludeClipboardContentFromMonitorProcessing (como gerenciadores de senha). */
  sensivel?: boolean;
}

/** Filtro de elementos de UI Automation: janelas visíveis da classe (e processo) e o elemento por nome, tipo ou AutomationId. */
export interface FiltroUia {
  janelaClasse?: string;
  pid?: number;
  nome?: string;
  /** Nome exato (padrão) ou contendo o texto. */
  exato?: boolean;
  /** Button, MenuItem, ... (ControlType sem o prefixo). */
  tipo?: string;
  automationId?: string;
  limiteMs?: number;
}

export interface ElementoUia {
  nome: string;
  classe: string;
  automationId: string;
  tipo: string;
  foraDaTela: boolean;
  retangulo: Retangulo | null;
}

interface Pendente {
  resolver: (valor: unknown) => void;
  rejeitar: (erro: Error) => void;
  timer: NodeJS.Timeout;
}

/** O JSON vai em ASCII puro (o helper lê a entrada na página de código do console). */
function jsonAscii(valor: unknown): string {
  return JSON.stringify(valor).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export class HelperWindows {
  private pendentes = new Map<number, Pendente>();
  private proximo = 1;
  private buffer = "";
  private encerrado = false;
  private erros = "";

  private constructor(
    private processo: ChildProcessWithoutNullStreams,
    private registro?: string,
  ) {
    processo.stdout.setEncoding("utf8");
    processo.stdout.on("data", (trecho: string) => this.receber(trecho));
    processo.stderr.setEncoding("utf8");
    processo.stderr.on("data", (trecho: string) => {
      this.erros = (this.erros + trecho).slice(-8000);
      this.anotar(`stderr: ${trecho.trimEnd()}`);
    });
    processo.on("error", (erro) => this.anotar(`erro ao iniciar o processo: ${String(erro)}`));
    processo.on("exit", (codigo, sinal) => {
      this.encerrado = true;
      this.anotar(`processo terminou (código ${codigo}, sinal ${sinal})`);
      for (const [, p] of this.pendentes) {
        clearTimeout(p.timer);
        p.rejeitar(new Error(`O helper do Windows terminou (código ${codigo}, sinal ${sinal}). ${this.erros}`));
      }
      this.pendentes.clear();
    });
  }

  private anotar(mensagem: string): void {
    if (!this.registro) return;
    try {
      appendFileSync(this.registro, `[${new Date().toISOString()}] ${mensagem}\n`);
    } catch {
      // o registro é só diagnóstico
    }
  }

  /**
   * Abre o PowerShell do helper. NÃO usar `detached`: sem console o PowerShell sai com código 0 sem rodar o script
   * (causa da falha do primeiro test:windows). O Ctrl+C do terminal é ignorado pelo próprio helper (CancelKeyPress);
   * se o Node morrer, a entrada fecha e o guardião do helper age. `registro`: arquivo que recebe o stderr e o fim do processo.
   */
  static async iniciar(registro?: string): Promise<HelperWindows> {
    const script = resolve(process.cwd(), "e2e", "support", "windows", "helper.ps1");
    const processo = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", script],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    const helper = new HelperWindows(processo, registro);
    helper.anotar(`iniciado (pid ${processo.pid}, cwd ${process.cwd()}, script ${script})`);
    try {
      await helper.esperarPronto();
    } catch (erro) {
      helper.matar();
      throw erro;
    }
    return helper;
  }

  private esperarPronto(): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => rejeitar(new Error(`O helper do Windows não ficou pronto em 90 s. ${this.erros}`)), 90_000);
      this.pendentes.set(0, {
        resolver: () => resolver(),
        rejeitar: (erro) => rejeitar(erro),
        timer,
      });
    });
  }

  private receber(trecho: string): void {
    this.buffer += trecho;
    let indice: number;
    while ((indice = this.buffer.indexOf("\n")) >= 0) {
      const linha = this.buffer.slice(0, indice).trim();
      this.buffer = this.buffer.slice(indice + 1);
      if (!linha) continue;
      let mensagem: { id?: number; pronto?: boolean; ok?: boolean; resultado?: unknown; erro?: string };
      try {
        mensagem = JSON.parse(linha);
      } catch {
        continue; // linha que não é do protocolo
      }
      const id = mensagem.pronto ? 0 : mensagem.id;
      const pendente = id === undefined ? undefined : this.pendentes.get(id);
      if (!pendente || id === undefined) continue;
      this.pendentes.delete(id);
      clearTimeout(pendente.timer);
      if (mensagem.pronto || mensagem.ok) pendente.resolver(mensagem.resultado);
      else pendente.rejeitar(new Error(mensagem.erro ?? "Erro desconhecido no helper."));
    }
  }

  get vivo(): boolean {
    return !this.encerrado;
  }

  /** Envia um comando e espera a resposta. */
  chamar<T = unknown>(comando: string, args: object = {}, limiteMs = 30_000): Promise<T> {
    if (this.encerrado) return Promise.reject(new Error(`O helper do Windows não está rodando. ${this.erros}`));
    const id = this.proximo++;
    return new Promise<T>((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        rejeitar(new Error(`O helper não respondeu a "${comando}" em ${limiteMs} ms.`));
      }, limiteMs);
      this.pendentes.set(id, { resolver: resolver as (v: unknown) => void, rejeitar, timer });
      this.processo.stdin.write(jsonAscii({ id, cmd: comando, args }) + "\n");
    });
  }

  /** Encerra o helper pelo comando de saída; mata o processo se não responder. */
  async encerrar(): Promise<void> {
    if (this.encerrado) return;
    await this.chamar("sair", {}, 5_000).catch(() => undefined);
    await new Promise<void>((resolver) => {
      if (this.encerrado) return resolver();
      const timer = setTimeout(() => {
        this.matar();
        resolver();
      }, 3_000);
      this.processo.once("exit", () => {
        clearTimeout(timer);
        resolver();
      });
    });
  }

  private matar(): void {
    this.processo.kill();
  }

  // ---- entrada real (SendInput)

  /** Combinação de teclas: "Alt+Q", "Ctrl+V", "Esc", "Enter", "Down", "Shift+Delete", "F2". */
  tecla(combinacao: string): Promise<void> {
    return this.chamar("tecla", { combo: combinacao }).then(() => undefined);
  }

  /** Texto Unicode, caractere a caractere; "\n" vira Enter. */
  digitar(texto: string, atrasoMs = 8): Promise<void> {
    return this.chamar("digitar", { texto, atrasoMs }, 30_000 + texto.length * (atrasoMs + 20)).then(() => undefined);
  }

  /** Espera Ctrl, Alt, Shift e Win soltos (fisicamente); devolve false se algum ficou apertado até o limite. */
  esperarModificadoresSoltos(limiteMs = 3_000): Promise<boolean> {
    return this.chamar<boolean>("esperarModificadoresSoltos", { limiteMs }, limiteMs + 5_000);
  }

  /** Solta modificadores que tenham ficado presos por uma falha no meio de uma combinação. */
  soltarModificadores(): Promise<void> {
    return this.chamar("soltarModificadores").then(() => undefined);
  }

  /** Move o cursor para (x, y), em pixels físicos da tela. */
  mouseMover(x: number, y: number): Promise<{ x: number; y: number }> {
    return this.chamar("mouseMover", { x, y });
  }

  mouseClicar(x: number, y: number, opcoes: { botao?: "esquerdo" | "direito"; vezes?: number } = {}): Promise<void> {
    return this.chamar("mouseClicar", { x, y, ...opcoes }).then(() => undefined);
  }

  mouseArrastar(de: { x: number; y: number }, para: { x: number; y: number }, passos = 12): Promise<void> {
    return this.chamar("mouseArrastar", { x1: de.x, y1: de.y, x2: para.x, y2: para.y, passos }, 60_000).then(() => undefined);
  }

  mouseRolar(delta: number): Promise<void> {
    return this.chamar("mouseRolar", { delta }).then(() => undefined);
  }

  mousePosicao(): Promise<{ x: number; y: number }> {
    return this.chamar("mousePosicao");
  }

  // ---- tela e janelas

  telaInfo(): Promise<{ virtual: Retangulo; principal: { largura: number; altura: number }; monitores: number }> {
    return this.chamar("telaInfo");
  }

  /** Captura a tela inteira (todos os monitores) em PNG. */
  capturarTela(caminho: string): Promise<void> {
    return this.chamar("capturarTela", { caminho }).then(() => undefined);
  }

  primeiroPlano(): Promise<JanelaInfo | null> {
    return this.chamar("primeiroPlano");
  }

  janelas(opcoes: { pid?: number; soVisiveis?: boolean } = {}): Promise<JanelaInfo[]> {
    return this.chamar("janelas", opcoes);
  }

  // ---- janela alvo (formulário próprio, caixa de texto multilinha)

  alvoAbrir(opcoes: { x?: number; y?: number; largura?: number; altura?: number; titulo?: string } = {}): Promise<PosicaoDoAlvo> {
    return this.chamar("alvoAbrir", opcoes);
  }

  /** Traz a janela alvo ao primeiro plano e foca a caixa; devolve se ela ficou em primeiro plano. */
  alvoFocar(): Promise<boolean> {
    return this.chamar<boolean>("alvoFocar", {}, 20_000);
  }

  alvoLimpar(): Promise<void> {
    return this.chamar("alvoLimpar").then(() => undefined);
  }

  /** Texto da caixa, com quebras de linha normalizadas para \n. */
  async alvoLer(): Promise<string> {
    return (await this.chamar<string>("alvoLer")).replace(/\r\n/g, "\n");
  }

  /** Grava o texto direto na caixa (sem teclado nem clipboard). */
  alvoEscrever(texto: string): Promise<void> {
    return this.chamar("alvoEscrever", { texto }).then(() => undefined);
  }

  alvoPosicao(): Promise<PosicaoDoAlvo> {
    return this.chamar("alvoPosicao");
  }

  alvoFechar(): Promise<void> {
    return this.chamar("alvoFechar").then(() => undefined);
  }

  // ---- clipboard

  clipResumo(): Promise<ResumoDoClipboard> {
    return this.chamar("clipResumo");
  }

  clipTexto(): Promise<string | null> {
    return this.chamar("clipTexto");
  }

  /** Conteúdo bruto do formato "HTML Format" (com cabeçalho CF_HTML). */
  clipHtml(): Promise<string | null> {
    return this.chamar("clipHtml");
  }

  /** Só o fragmento (entre StartFragment e EndFragment) do formato "HTML Format". */
  async clipHtmlFragmento(): Promise<string | null> {
    const bruto = await this.clipHtml();
    if (bruto === null) return null;
    const inicio = /StartFragment:(\d+)/.exec(bruto);
    const fim = /EndFragment:(\d+)/.exec(bruto);
    if (!inicio || !fim) return bruto;
    const bytes = Buffer.from(bruto, "utf8");
    return bytes.subarray(Number(inicio[1]), Number(fim[1])).toString("utf8");
  }

  clipRtf(): Promise<string | null> {
    return this.chamar("clipRtf");
  }

  clipEscrever(conteudo: EscritaDoClipboard): Promise<{ sequencia: number }> {
    return this.chamar("clipEscrever", conteudo);
  }

  clipEsvaziar(): Promise<void> {
    return this.chamar("clipEsvaziar").then(() => undefined);
  }

  clipSequencia(): Promise<number> {
    return this.chamar("clipSequencia");
  }

  /** Cópia bruta do clipboard atual, para devolver depois com clipRestaurar. */
  clipSalvar(): Promise<FormatoSalvo[]> {
    return this.chamar("clipSalvar", {}, 60_000);
  }

  clipRestaurar(formatos: FormatoSalvo[]): Promise<{ restaurados: number; falhas: number }> {
    return this.chamar("clipRestaurar", { formatos }, 60_000);
  }

  // ---- diálogos nativos de arquivo (abrir, salvar, escolher pasta), por UI Automation

  /** Espera o diálogo (#32770) visível do processo; devolve null se não apareceu. */
  dialogoEsperar(pid: number, limiteMs = 10_000): Promise<JanelaInfo | null> {
    return this.chamar("dialogoEsperar", { pid, limiteMs }, limiteMs + 5_000);
  }

  /**
   * Escreve um NOME SIMPLES (ou vários entre aspas) no campo de nome e aciona o botão padrão (Abrir, Salvar). Nunca caminho: a
   * pasta vem de `dialogoNavegar`, e com `pastaEsperada` (pasta temporária cstm-e2e-*) o helper confere que o diálogo está nela;
   * se não estiver, cancela o diálogo e falha, sem salvar nem abrir nada. O texto vai por Win32 direto no controle (WM_SETTEXT no Edit
   * do campo Nome, conferido com WM_GETTEXT) e a confirmação é um BM_CLICK no IDOK: sem teclado nem foco. Uma pergunta de substituir
   * arquivo cancela e falha. Tem limite interno de 10 s.
   */
  dialogoPreencher(
    pid: number,
    caminho: string,
    opcoes: { limiteMs?: number; esperarFechar?: boolean; pastaEsperada?: string } = {},
  ): Promise<{ titulo: string; fechou: boolean }> {
    const limiteMs = opcoes.limiteMs ?? 8_000;
    return this.chamar("dialogoPreencher", { pid, caminho, limiteMs, esperarFechar: opcoes.esperarFechar ?? true, pastaEsperada: opcoes.pastaEsperada }, limiteMs + 12_000);
  }

  /** Navega o diálogo até a pasta pela barra de endereço (Alt+D, caminho, Enter), sem confirmar. */
  dialogoNavegar(pid: number, caminho: string, limiteMs = 8_000): Promise<{ titulo: string }> {
    return this.chamar("dialogoNavegar", { pid, caminho, limiteMs }, limiteMs + 12_000);
  }

  /** Seletor de PASTA: navega até a pasta pela barra de endereço e aciona "Selecionar pasta". Nunca digitar o caminho no campo de nome. */
  dialogoPasta(pid: number, caminho: string, limiteMs = 8_000): Promise<{ titulo: string; fechou: boolean }> {
    return this.chamar("dialogoPasta", { pid, caminho, limiteMs }, limiteMs + 15_000);
  }

  /** Fecha (WM_CLOSE) todos os diálogos visíveis do processo, os de erro primeiro; devolve quantos fechou. */
  dialogoFechar(pid: number): Promise<number> {
    return this.chamar<number>("dialogoFechar", { pid }, 10_000);
  }

  /** Aciona um botão do diálogo pelo AutomationId (por exemplo "6" = Sim, na confirmação de substituir arquivo). */
  dialogoResponder(pid: number, botaoId: string, limiteMs = 5_000): Promise<{ titulo: string }> {
    return this.chamar("dialogoResponder", { pid, botaoId, limiteMs }, limiteMs + 5_000);
  }

  // ---- UI Automation (bandeja, menus nativos)

  /** Árvore de UI Automation das janelas visíveis (classe e/ou processo), uma linha por elemento; para diagnóstico. */
  uiaDump(opcoes: { classe?: string; pid?: number; profundidade?: number; maximo?: number } = {}): Promise<string[]> {
    return this.chamar("uiaDump", opcoes, 60_000);
  }

  /** Primeiro elemento que casa (espera até limiteMs); null se não achou. */
  uiaEncontrar(filtro: FiltroUia): Promise<ElementoUia | null> {
    return this.chamar("uiaEncontrar", filtro, (filtro.limiteMs ?? 3_000) + 30_000);
  }

  /** Todos os elementos que casam (espera até limiteMs por algum). */
  uiaListar(filtro: FiltroUia): Promise<ElementoUia[]> {
    return this.chamar("uiaListar", filtro, (filtro.limiteMs ?? 3_000) + 30_000);
  }

  /** Aciona o elemento (Invoke, Toggle ou Select), sem mouse nem teclado; erro se não achar. */
  uiaInvocar(filtro: FiltroUia): Promise<ElementoUia> {
    return this.chamar("uiaInvocar", filtro, (filtro.limiteMs ?? 3_000) + 30_000);
  }

  /** Traz qualquer janela (hwnd) ao primeiro plano; devolve se conseguiu. */
  janelaFocar(hwnd: number): Promise<boolean> {
    return this.chamar<boolean>("janelaFocar", { hwnd }, 20_000);
  }

  // ---- guardião

  /** Se o Node morrer, o helper devolve o clipboard e reabre o CSTM instalado (se `caminhoCstm`). */
  guardiaoArmar(opcoes: { formatos: FormatoSalvo[]; caminhoCstm?: string; argumentos?: string; ignorar?: string }): Promise<void> {
    return this.chamar("guardiaoArmar", opcoes, 60_000).then(() => undefined);
  }

  guardiaoDesarmar(): Promise<void> {
    return this.chamar("guardiaoDesarmar").then(() => undefined);
  }
}
