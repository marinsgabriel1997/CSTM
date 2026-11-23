import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import process from "node:process";
import {
  ARGUMENTO_DO_LOGIN,
  caminhoDoBuildDeTeste,
  encerrarPorPid,
  esperarSairem,
  listarDoBuildDeTeste,
  listarInstalados,
  reabrirComoNoLogin,
} from "./cstm-instalado";
import { ENSAIO } from "./ensaio";
import { HelperWindows, type FormatoSalvo } from "./helper";
import { arquivoDoWindows, hora } from "./log";

/**
 * Sessão do projeto "windows": o teste usa o teclado, o mouse e o clipboard de verdade, e o Alt+Q que o CSTM instalado
 * ocupa. Ela guarda o clipboard do usuário, fecha o CSTM instalado e, no fim (também em falha ou interrupção), devolve
 * o clipboard e reabre o CSTM instalado do mesmo caminho e do mesmo jeito que o Windows o inicia no login.
 *
 * Camadas de proteção:
 * (1) Nada é fechado antes de o helper provar que funciona (ping e cópia do clipboard).
 * (2) O estado (caminho do CSTM fechado, clipboard salvo) vai para arquivos ANTES de fechar; uma execução seguinte detecta
 *     uma sessão não restaurada e restaura primeiro.
 * (3) A reabertura do CSTM é feita pelo Node, sem depender do helper vivo: globalTeardown, sinais (SIGINT/SIGTERM/SIGHUP)
 *     e o evento "exit" do processo.
 * (4) O guardião do helper restaura o clipboard e reabre o CSTM se o Node morrer sem aviso.
 * Tudo é registrado em e2e/.resultados/windows/sessao.log; o stderr do helper vai para helper.log.
 *
 * Arquivos (e2e/.resultados/windows/): sessao.json (estado), clipboard-salvo.json (o clipboard do usuário enquanto a
 * sessão está aberta; apagado ao restaurar), sessao.log, helper.log.
 */

interface EstadoEmArquivo {
  iniciadaEm: string;
  /** Caminho do CSTM instalado que estava aberto e foi fechado (null: não estava aberto). */
  cstmCaminho: string | null;
  /** O CSTM foi fechado e ainda não foi reaberto. */
  cstmPendente: boolean;
  /** O clipboard foi salvo em clipboard-salvo.json e ainda não foi devolvido. */
  clipboardPendente: boolean;
}

const ARQ_ESTADO = () => arquivoDoWindows("sessao.json");
const ARQ_CLIPBOARD = () => arquivoDoWindows("clipboard-salvo.json");
const ARQ_LOG = () => arquivoDoWindows("sessao.log");
const ARQ_HELPER_LOG = () => arquivoDoWindows("helper.log");

let helperDaSessao: HelperWindows | undefined;
let hashesAntes: Record<string, string> = {};
let estado: EstadoEmArquivo | undefined;
let restauracao: Promise<void> | undefined;

/** Registra uma etapa no terminal e em sessao.log: horário, ação e resultado. */
function logar(acao: string, resultado = ""): void {
  const linha = `[${hora()}] [sessão] ${acao}${resultado ? ` -> ${resultado}` : ""}`;
  console.log(linha);
  try {
    appendFileSync(ARQ_LOG(), `${new Date().toISOString()} ${acao}${resultado ? ` -> ${resultado}` : ""}\n`);
  } catch {
    // o registro é só diagnóstico
  }
}

function gravarEstado(): void {
  if (estado) writeFileSync(ARQ_ESTADO(), JSON.stringify(estado, null, 2));
}

function lerEstadoAnterior(): EstadoEmArquivo | undefined {
  if (!existsSync(ARQ_ESTADO())) return undefined;
  try {
    return JSON.parse(readFileSync(ARQ_ESTADO(), "utf8")) as EstadoEmArquivo;
  } catch {
    return undefined;
  }
}

/** Reabre o CSTM pelo Node (sem o helper), solto do processo atual; síncrono, para servir também no evento "exit". */
function iniciarCstmSemEsperar(caminho: string): void {
  const filho = spawn(caminho, [ARGUMENTO_DO_LOGIN], { detached: true, stdio: "ignore" });
  filho.unref();
}

/** Reabre o CSTM se ainda estiver pendente; confirma que ficou em execução. Nunca depende do helper. */
async function reabrirCstmSePendente(s: EstadoEmArquivo, problemas: string[]): Promise<void> {
  if (!s.cstmPendente) return;
  if (!s.cstmCaminho) {
    s.cstmPendente = false;
    gravarEstado();
    return;
  }
  try {
    if (listarInstalados().some((p) => p.caminho !== null)) {
      logar("reabrir o CSTM instalado", "já estava aberto de novo");
    } else {
      const pid = await reabrirComoNoLogin(s.cstmCaminho);
      if (pid === null) throw new Error("o processo não apareceu em 15 s");
      logar("reabrir o CSTM instalado", `ok, pid ${pid} (${s.cstmCaminho} ${ARGUMENTO_DO_LOGIN})`);
    }
    s.cstmPendente = false;
    gravarEstado();
  } catch (erro) {
    logar("reabrir o CSTM instalado", `FALHOU: ${String(erro)}`);
    problemas.push(`o CSTM instalado não reabriu (${s.cstmCaminho})`);
  }
}

/** Devolve o clipboard guardado em arquivo (ou em memória, se houver) pelo helper; reinicia o helper se preciso. */
async function devolverClipboard(s: EstadoEmArquivo, problemas: string[]): Promise<void> {
  if (!s.clipboardPendente) return;
  let proprio: HelperWindows | undefined;
  try {
    let helper = helperDaSessao;
    if (!helper?.vivo) {
      helper = proprio = await HelperWindows.iniciar(ARQ_HELPER_LOG());
      await helper.chamar("ping");
    }
    const formatos = JSON.parse(readFileSync(ARQ_CLIPBOARD(), "utf8")) as FormatoSalvo[];
    await helper.soltarModificadores().catch(() => undefined);
    const r = await helper.clipRestaurar(formatos);
    const depois = (await helper.clipResumo()).hashes;
    const diferentes = Object.keys(hashesAntes).filter((nome) => depois[nome] !== hashesAntes[nome]);
    logar("restaurar o clipboard do usuário", `${r.restaurados} formatos, ${r.falhas} falhas, ${diferentes.length} diferentes`);
    if (r.falhas > 0 || diferentes.length > 0) {
      problemas.push(`o clipboard não voltou idêntico (${diferentes.join(", ") || "falhas de escrita"})`);
    }
    s.clipboardPendente = false;
    gravarEstado();
    rmSync(ARQ_CLIPBOARD(), { force: true });
  } catch (erro) {
    logar("restaurar o clipboard do usuário", `FALHOU: ${String(erro)} (cópia mantida em clipboard-salvo.json)`);
    problemas.push("o clipboard não foi restaurado (cópia em e2e/.resultados/windows/clipboard-salvo.json)");
  } finally {
    await proprio?.encerrar().catch(() => undefined);
  }
}

/** Restaura uma sessão anterior que morreu sem restaurar: clipboard e CSTM. */
async function recuperarSessaoAnterior(): Promise<void> {
  const anterior = lerEstadoAnterior();
  if (!anterior || (!anterior.cstmPendente && !anterior.clipboardPendente)) return;
  logar("sessão anterior não restaurada", JSON.stringify(anterior));
  if (ENSAIO) {
    logar("ensaio", "não restauro a sessão anterior; rode sem CSTM_E2E_ENSAIO para recuperá-la");
    return;
  }
  const problemas: string[] = [];
  estado = anterior;
  try {
    await devolverClipboard(anterior, problemas);
  } finally {
    await reabrirCstmSePendente(anterior, problemas);
  }
  estado = undefined;
  if (problemas.length > 0) throw new Error(`Não consegui restaurar a sessão anterior: ${problemas.join("; ")}.`);
  logar("sessão anterior restaurada");
}

let sinaisInstalados = false;
function instalarProtecoes(): void {
  if (sinaisInstalados) return;
  sinaisInstalados = true;
  for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sinal, () => {
      logar(`${sinal} recebido`, "restaurando o clipboard e o CSTM instalado");
      // Dá tempo ao Playwright de encerrar os testes (seu globalTeardown chama a mesma restauração, idempotente).
      setTimeout(() => void restaurarSessao().catch((erro) => logar("restauração após sinal", `FALHOU: ${String(erro)}`)), 3_000).unref();
    });
  }
  // Último recurso, síncrono: se o processo termina com o CSTM ainda fechado, ao menos o reabre.
  process.on("exit", () => {
    if (estado?.cstmPendente && estado.cstmCaminho) {
      try {
        iniciarCstmSemEsperar(estado.cstmCaminho);
        appendFileSync(ARQ_LOG(), `${new Date().toISOString()} exit do processo com o CSTM fechado -> reaberto às pressas\n`);
      } catch {
        // nada mais a fazer
      }
    }
  });
}

/**
 * Prepara a sessão. Nada é fechado antes de o helper provar que funciona; se algo falhar depois de fechar o CSTM, a
 * restauração roda antes de o erro ser relançado.
 */
export async function prepararSessao(): Promise<void> {
  if (helperDaSessao) throw new Error("A sessão do Windows já foi preparada.");
  logar("início da sessão", `cwd=${process.cwd()} ensaio=${ENSAIO}`);
  await recuperarSessaoAnterior();

  // 1. O helper tem de funcionar antes de qualquer efeito.
  const helper = await HelperWindows.iniciar(ARQ_HELPER_LOG());
  helperDaSessao = helper;
  try {
    logar("iniciar o helper", `ok (powershell pid; log em ${ARQ_HELPER_LOG()})`);
    logar("ping do helper", String(await helper.chamar("ping")));
    const instalados = listarInstalados();
    logar("CSTM instalado em execução", instalados.length === 0 ? "nenhum" : instalados.map((p) => `pid ${p.pid} ${p.caminho ?? "(caminho ilegível)"}`).join("; "));
    if (ENSAIO) {
      logar("ensaio", "helper ok; nada foi fechado, salvo nem restaurado");
      await helper.encerrar();
      helperDaSessao = undefined;
      return;
    }
    if (instalados.some((p) => p.caminho === null)) {
      throw new Error("Há um cstm.exe com caminho ilegível; não dá para saber se é o instalado. Nada foi alterado.");
    }
    const formatos = await helper.clipSalvar();
    hashesAntes = (await helper.clipResumo()).hashes;
    logar("salvar o clipboard do usuário", `${formatos.length} formatos`);

    // 2. O estado vai para arquivo antes de qualquer efeito.
    const caminho = instalados[0]?.caminho ?? null;
    writeFileSync(ARQ_CLIPBOARD(), JSON.stringify(formatos));
    estado = { iniciadaEm: new Date().toISOString(), cstmCaminho: caminho, cstmPendente: false, clipboardPendente: true };
    gravarEstado();
    instalarProtecoes();
    await helper.guardiaoArmar({ formatos, caminhoCstm: caminho ?? undefined, argumentos: ARGUMENTO_DO_LOGIN, ignorar: caminhoDoBuildDeTeste() });
    logar("armar o guardião do helper", "ok");

    // 3. Só agora fecha o CSTM instalado.
    if (instalados.length > 0) {
      estado.cstmPendente = true;
      gravarEstado();
      for (const p of instalados) encerrarPorPid(p.pid);
      if (!(await esperarSairem(instalados.map((p) => p.pid)))) throw new Error("O CSTM instalado não fechou em 15 s.");
      logar("fechar o CSTM instalado", `ok (${caminho}); será reaberto no fim`);
    }
  } catch (erro) {
    logar("falha na preparação", String(erro));
    await restaurarSessao().catch((e) => logar("restauração após a falha", `FALHOU: ${String(e)}`));
    await helper.encerrar().catch(() => undefined);
    helperDaSessao = undefined;
    throw erro;
  }
}

/** Devolve o clipboard, encerra restos do build de teste e reabre o CSTM instalado. Idempotente. */
export function restaurarSessao(): Promise<void> {
  if (!estado) return Promise.resolve();
  restauracao ??= executarRestauracao(estado);
  return restauracao;
}

async function executarRestauracao(s: EstadoEmArquivo): Promise<void> {
  const problemas: string[] = [];
  logar("início da restauração");
  try {
    await helperDaSessao?.alvoFechar().catch(() => undefined);
  } catch (erro) {
    logar("fechar a janela alvo", `ignorado: ${String(erro)}`);
  }
  try {
    // O build de teste que sobrou (falha de um teste) seguraria o Alt+Q e a instância única. Se o processo já foi morto à mão,
    // ou a listagem falhar, a limpeza é só um aviso: o importante (clipboard e CSTM instalado) vem a seguir.
    for (const p of listarDoBuildDeTeste()) {
      encerrarPorPid(p.pid);
      logar("encerrar o build de teste que sobrou", `pid ${p.pid}`);
    }
  } catch (erro) {
    logar("limpeza do build de teste", `ignorada (o processo pode já ter sido encerrado): ${String(erro)}`);
  }
  try {
    // O clipboard volta antes de o CSTM abrir, para o histórico dele não registrar o que o teste deixou.
    await devolverClipboard(s, problemas);
  } finally {
    // O CSTM reabre sempre, mesmo que o clipboard falhe, e sem depender do helper.
    await reabrirCstmSePendente(s, problemas);
    await helperDaSessao?.guardiaoDesarmar().catch(() => undefined);
    await helperDaSessao?.encerrar().catch(() => undefined);
  }
  if (problemas.length > 0) {
    logar("restauração incompleta", problemas.join("; "));
    throw new Error(`Restauração incompleta: ${problemas.join("; ")}.`);
  }
  logar("restauração concluída");
}

/** O CSTM instalado estava aberto no início da sessão? (para o relatório) */
export function cstmInstaladoEstavaAberto(): boolean {
  return estado?.cstmCaminho != null;
}
