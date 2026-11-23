import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AppDeTeste } from "./app";
import { invocar, semear, type Semente } from "./biblioteca";

/**
 * O menu de colagem (janela picker) só é aberto pelo atalho global, que a camada do app não aperta, e a função
 * que o abre é privada do backend. O que dá para fazer sem o atalho e sem mudar o app: a página picker já existe
 * (oculta) e, a cada abertura, só reage ao evento "picker-opened". Este suporte envia o mesmo evento
 * (pelo main) e usa a página como o usuário usaria.
 *
 * Limites desse caminho: o backend não registrou a abertura (`show()`), então o comando `layout_picker` responde
 * "o menu de colagem ainda não foi aberto" e as colunas da cascata não abrem (ficam para a camada do Windows).
 * A janela segue oculta, então só se confere o que a página faz (as chamadas ao backend são registradas).
 */

/** Comandos que colam ou escrevem no clipboard; a trava abaixo os recusa mesmo que um teste os dispare sem querer. */
const PROIBIDOS = /^(choose_snippet|copy_snippet|paste_clipboard_item|copy_clipboard_item|update_clipboard_item|clear_clipboard_history)$/;

export interface Chamada {
  comando: string;
}

/**
 * Instala na página picker a trava de comandos, o registro das chamadas e os usos simulados. O `invoke` do Tauri não
 * pode ser trocado (propriedade fixa), mas ele chama `fetch("http://ipc.localhost/<comando>")`, que pode.
 */
async function instalarEspiao(picker: Page): Promise<void> {
  await picker.evaluate((proibidos) => {
    const janela = window as unknown as { __chamadas?: Chamada[]; __usos?: Record<number, number> };
    if (janela.__chamadas) return;
    janela.__chamadas = [];
    janela.__usos = {};
    const original = window.fetch.bind(window);
    const proibido = new RegExp(proibidos);
    window.fetch = async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada));
      if (url.hostname !== "ipc.localhost") return original(entrada, opcoes);
      const comando = decodeURIComponent(url.pathname.slice(1));
      janela.__chamadas!.push({ comando });
      if (proibido.test(comando)) {
        return new Response(JSON.stringify(`bloqueado pelo teste: ${comando}`), { headers: { "Tauri-Response": "error", "Content-Type": "application/json" } });
      }
      const resposta = await original(entrada, opcoes);
      // O uso de um texto só sobe ao colar ou copiar (comandos proibidos aqui): o teste o simula na resposta da lista.
      if (comando === "list_all_snippets") {
        const lista = (await resposta.clone().json()) as { id: number; useCount: number }[];
        const simulada = lista.map((t) => ({ ...t, useCount: janela.__usos![t.id] ?? t.useCount }));
        return new Response(JSON.stringify(simulada), { status: resposta.status, headers: resposta.headers });
      }
      return resposta;
    };
  }, PROIBIDOS.source);
}

export interface MenuAberto {
  picker: Page;
  /** Envia de novo o aviso de abertura, como o backend faz a cada vez que o menu abre. */
  reabrir: () => Promise<void>;
  /** Comandos que a página chamou desde o início. */
  chamadas: () => Promise<Chamada[]>;
  /** Simula quantas vezes cada texto foi usado (por id), valendo a partir da próxima abertura. */
  usos: (usos: Record<number, number>) => Promise<void>;
}

/** Semeia os dados e abre o menu: devolve a página picker já com a busca focada. */
export async function abrirMenu(
  app: AppDeTeste,
  main: Page,
  semente: Semente,
  opcoes: { navegacao?: "cascade" | "click"; modo?: "markdown" | "plain" | "rich" | "chat" } = {},
): Promise<MenuAberto & { ids: Record<string, number> }> {
  const ids = semente.pastas || semente.raiz ? await semear(main, semente) : {};
  if (opcoes.navegacao) await invocar(main, "set_picker_navigation", { navigation: opcoes.navegacao });
  if (opcoes.modo) await invocar(main, "set_paste_format", { format: opcoes.modo });
  // Sem o histórico ligado, uma cópia feita pelo usuário durante o teste não aparece no menu.
  await invocar(main, "set_clipboard_monitoring", { enabled: false });
  const picker = await app.picker();
  await instalarEspiao(picker);
  const reabrir = async () => {
    // A página responde ao aviso de abertura de forma assíncrona (zera pasta, seleção e busca e recarrega os dados) e,
    // ao fim, chama picker_ready. Sem esperar por isso, um clique logo depois podia cair antes do reinício do estado e ser
    // desfeito por ele (a causa da intermitência de "Favoritos, Mais usados e pastas abrem na própria coluna").
    const prontos = () =>
      picker.evaluate(() => (window as unknown as { __chamadas: Chamada[] }).__chamadas.filter((c) => c.comando === "picker_ready").length);
    const antes = await prontos();
    await invocar(main, "plugin:event|emit_to", {
      target: { kind: "WebviewWindow", label: "picker" },
      event: "picker-opened",
      payload: { x: 10, y: 10, width: 420, height: 440, hidden: false },
    });
    await expect.poll(prontos, { message: "o menu não terminou de reabrir (picker_ready)" }).toBeGreaterThan(antes);
    await expect(picker.getByRole("combobox", { name: "Buscar" })).toBeFocused();
  };
  await reabrir();
  return {
    picker,
    ids,
    reabrir,
    chamadas: () => picker.evaluate(() => (window as unknown as { __chamadas: Chamada[] }).__chamadas),
    usos: (usos) => picker.evaluate((u) => void Object.assign((window as unknown as { __usos: object }).__usos, u), usos),
  };
}

/** Texto de cada linha da coluna principal (título e, se houver, o complemento), sem os botões. */
export function linhasDoMenu(picker: Page): Promise<string[]> {
  return picker
    .getByRole("listbox", { name: "Textos" })
    .getByRole("option")
    .evaluateAll((itens) => itens.map((el) => (el as HTMLElement).innerText.split("\n").map((p) => p.trim()).filter(Boolean).join(" | ")));
}

/** A linha selecionada (aria-selected) da coluna principal. */
export function linhaSelecionada(picker: Page) {
  return picker.getByRole("listbox", { name: "Textos" }).locator('[role="option"][aria-selected="true"]');
}
