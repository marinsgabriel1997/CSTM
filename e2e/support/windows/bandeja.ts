import { expect } from "@playwright/test";
import type { AppDeTeste } from "../app";
import type { ElementoUia, HelperWindows } from "./helper";
import { centro, esperar } from "./cenario";

/**
 * Ícone da bandeja do app de teste pela UI Automation. No Windows 11 o ícone fica na barra (Shell_TrayWnd, botão
 * "CSTM") ou no estouro da área de notificação, aberto pelo botão "NotificationChevron". O menu é um menu nativo
 * (classe #32768) do processo do app, aberto com clique direito REAL no ícone; os itens são acionados por UI Automation.
 */

const NOME_DO_ICONE = "CSTM";

const NA_BARRA = { janelaClasse: "Shell_TrayWnd", nome: NOME_DO_ICONE, tipo: "Button" } as const;
const NO_ESTOURO = { janelaClasse: "TopLevelWindowForOverflowXamlIsland", nome: NOME_DO_ICONE, tipo: "Button" } as const;

/**
 * Ícones "CSTM" clicáveis. O ícone de um programa novo costuma ir para o estouro: o botão "Mostrar ícones ocultos"
 * (SystemTray.NormalButton, AutomationId SystemTrayIcon, só existe com ícones ocultos) abre o painel
 * "Janela de estouro da bandeja do sistema" (TopLevelWindowForOverflowXamlIsland), onde o ícone é o botão "CSTM".
 *
 * Na rodada 2 o painel abriu (o print mostra o ícone dentro dele), mas a lista voltou vazia: o painel XAML anima ao abrir e
 * o botão aparece primeiro com retângulo vazio ou "fora da tela". Por isso o painel é consultado em laço até o ícone ficar
 * visível, e o botão do estouro só é acionado uma vez e só se o painel ainda não existir.
 */
async function listarIcones(helper: HelperWindows, limiteMs: number): Promise<ElementoUia[]> {
  const comRetangulo = (lista: ElementoUia[]) => lista.filter((e) => e.retangulo && e.retangulo.largura > 0 && e.retangulo.altura > 0);
  const visiveis = (lista: ElementoUia[]) => comRetangulo(lista).filter((e) => !e.foraDaTela);
  const fim = Date.now() + limiteMs;
  let abriu = false;
  let ultimoDoEstouro: ElementoUia[];
  for (;;) {
    const naBarra = visiveis(await helper.uiaListar({ ...NA_BARRA, limiteMs: 200 }));
    if (naBarra.length > 0) return naBarra;
    const doEstouro = await helper.uiaListar({ ...NO_ESTOURO, limiteMs: 200 });
    ultimoDoEstouro = doEstouro;
    const noEstouro = visiveis(doEstouro);
    if (noEstouro.length > 0) return noEstouro;
    if (doEstouro.length === 0 && !abriu) {
      abriu = true;
      // Abre o painel pelo próprio botão (Invoke, sem mouse). O nome muda para "...Ocultar" com ele aberto.
      await helper
        .uiaInvocar({ janelaClasse: "Shell_TrayWnd", nome: "ocultos", exato: false, tipo: "Button", limiteMs: 1_500 })
        .catch(() => undefined);
    }
    if (Date.now() > fim) break;
    await esperar(250);
  }
  // Último recurso: o ícone existe com retângulo, mas o Windows o marca "fora da tela" (o painel já está aberto).
  return comRetangulo(ultimoDoEstouro);
}

/**
 * Abre o menu da bandeja com o clique direito real. Um ícone "fantasma" (de um CSTM encerrado à força) pode existir ao
 * lado do novo; por isso tenta cada candidato até o menu do app de teste aparecer.
 */
export async function abrirMenuDaBandeja(helper: HelperWindows, app: AppDeTeste): Promise<void> {
  const icones = await listarIcones(helper, 4_000);
  if (icones.length === 0) {
    throw new Error(`O ícone "${NOME_DO_ICONE}" não apareceu na bandeja (nem no estouro). Veja o anexo da árvore de UI Automation.`);
  }
  for (const icone of icones.reverse()) {
    const ponto = centro(icone.retangulo!);
    await helper.mouseClicar(ponto.x, ponto.y, { botao: "direito" });
    const menu = await helper.uiaEncontrar({ janelaClasse: "#32768", pid: app.pid, tipo: "MenuItem", nome: "Sair", limiteMs: 2_000 });
    if (menu) return;
    await helper.tecla("Esc");
    await esperar(300);
  }
  throw new Error("Nenhum ícone CSTM da bandeja abriu o menu do app de teste (clique direito).");
}

const ORDEM_DO_MENU = ["Abrir cadastro", "Configurações", "Ajuda", "Sobre o CSTM", "Sair"];

/** Aciona um item do menu da bandeja já aberto: por UI Automation e, se ela não alcançar, pelo teclado (setas e Enter). */
export async function acionarItemDaBandeja(helper: HelperWindows, app: AppDeTeste, nome: string): Promise<"uia" | "teclado"> {
  try {
    await helper.uiaInvocar({ janelaClasse: "#32768", pid: app.pid, tipo: "MenuItem", nome, limiteMs: 2_000 });
    return "uia";
  } catch {
    const posicao = ORDEM_DO_MENU.indexOf(nome);
    expect(posicao, `item de menu desconhecido: ${nome}`).toBeGreaterThanOrEqual(0);
    for (let i = 0; i <= posicao; i++) await helper.tecla("Down");
    await helper.tecla("Enter");
    return "teclado";
  }
}
