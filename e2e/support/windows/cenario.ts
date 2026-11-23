import { expect, type Locator, type Page } from "@playwright/test";
import type { AppDeTeste } from "../app";
import { invocar } from "../biblioteca";
import type { HelperWindows, JanelaInfo, PosicaoDoAlvo, Retangulo } from "./helper";
import { esperarMenuAberto, esperarMenuFechado, menuVisivel } from "./menu";

export { esperarMenuFechado, menuVisivel };

/**
 * Cenas comuns das specs do Windows: abrir o menu com o atalho real, escolher um texto com o teclado real, ler a janela
 * alvo e o histórico. Tudo aqui usa teclado, mouse e clipboard reais (só roda em test:windows).
 */

export interface Ctx {
  helper: HelperWindows;
  app: AppDeTeste;
  main: Page;
  alvo: PosicaoDoAlvo;
}

export const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

export const centro = (r: Retangulo) => ({ x: Math.round(r.x + r.largura / 2), y: Math.round(r.y + r.altura / 2) });

/** Sem o histórico ligado, o que o teste escreve no clipboard não aparece no menu nem muda o que ele lista. */
export async function desligarHistorico(main: Page): Promise<void> {
  await invocar(main, "set_clipboard_monitoring", { enabled: false });
}

/** Limpa a janela alvo e a traz ao primeiro plano com a caixa focada. */
export async function focarAlvo({ helper }: Ctx): Promise<void> {
  await helper.alvoLimpar();
  expect(await helper.alvoFocar(), "a janela alvo não ficou em primeiro plano").toBe(true);
}

export async function centroDoAlvo(helper: HelperWindows): Promise<{ x: number; y: number }> {
  return centro((await helper.alvoPosicao()).caixa);
}

/**
 * Foca a janela alvo, põe o cursor (por padrão no centro dela), espera as teclas modificadoras soltas, aperta o atalho
 * (por padrão Alt+Q) e espera o menu de colagem realmente aberto.
 */
export async function abrirMenu(
  ctx: Ctx,
  opcoes: { mouse?: { x: number; y: number }; atalho?: string; focar?: boolean } = {},
): Promise<Page> {
  if (opcoes.focar !== false) await focarAlvo(ctx);
  const ponto = opcoes.mouse ?? (await centroDoAlvo(ctx.helper));
  await ctx.helper.mouseMover(ponto.x, ponto.y);
  expect(await ctx.helper.esperarModificadoresSoltos(), "um modificador continua apertado").toBe(true);
  await ctx.helper.tecla(opcoes.atalho ?? "Alt+Q");
  return esperarMenuAberto(ctx);
}

/** Mantém a condição por `ms` (para provar que NADA aconteceu, como colar ou abrir o menu). */
export async function garantirPor(ms: number, condicao: () => Promise<boolean>, mensagem: string): Promise<void> {
  const fim = Date.now() + ms;
  do {
    expect(await condicao(), mensagem).toBe(true);
    await esperar(100);
  } while (Date.now() < fim);
}

export async function garantirAlvoVazio(helper: HelperWindows, ms = 1_000): Promise<void> {
  await garantirPor(ms, async () => (await helper.alvoLer()) === "", "a janela alvo recebeu texto");
}

export async function esperarAlvo(helper: HelperWindows, esperado: string, limiteMs = 10_000): Promise<void> {
  try {
    await expect
      .poll(() => helper.alvoLer(), { timeout: limiteMs, intervals: [50, 100, 200], message: "o texto não chegou à janela alvo" })
      .toBe(esperado);
  } catch (erro) {
    // Diagnóstico da falha: quem estava em primeiro plano e o que havia no clipboard (se a colagem não saiu, foi foco ou clipboard).
    const [frente, clip] = await Promise.all([
      helper.primeiroPlano().catch(() => null),
      helper.clipTexto().catch((e: unknown) => `(erro: ${String(e)})`),
    ]);
    const detalhe = `primeiro plano: ${frente ? `"${frente.titulo}" (pid ${frente.pid}, classe ${frente.classe})` : "nenhum"}; clipboard: ${JSON.stringify(clip)}`;
    throw new Error(`${erro instanceof Error ? erro.message : String(erro)}\n${detalhe}`, { cause: erro });
  }
}

/**
 * Espera o texto do clipboard. Laço próprio (e não expect.poll) para a falha dizer o que aconteceu: um expect.poll cujo
 * predicado trava (a leitura espera o clipboard ocupado por até 5 s no helper) só informa "Timeout ... waiting on the predicate",
 * sem o valor lido nem o erro. Aqui o erro leva o último valor, o último erro de leitura, o número de sequência e a janela em primeiro plano.
 */
export async function esperarClipboardTexto(helper: HelperWindows, esperado: string | null, limiteMs = 8_000): Promise<void> {
  const fim = Date.now() + limiteMs;
  let ultimo: string | null | undefined;
  let ultimoErro: string | undefined;
  let leituras = 0;
  for (;;) {
    try {
      ultimo = await helper.clipTexto();
      ultimoErro = undefined;
      if (ultimo === esperado) return;
    } catch (erro) {
      ultimoErro = String(erro);
    }
    leituras++;
    if (Date.now() >= fim) break;
    await esperar(100);
  }
  const [frente, sequencia] = await Promise.all([helper.primeiroPlano().catch(() => null), helper.clipSequencia().catch(() => null)]);
  throw new Error(
    [
      `o texto do clipboard não é o esperado (${leituras} leituras em ${limiteMs} ms)`,
      `  esperado: ${JSON.stringify(esperado)}`,
      `  último lido: ${ultimo === undefined ? "(nenhuma leitura concluiu)" : JSON.stringify(ultimo)}`,
      `  último erro de leitura: ${ultimoErro ?? "nenhum"}`,
      `  sequência do clipboard: ${sequencia}; primeiro plano: ${frente ? `"${frente.titulo}" (pid ${frente.pid}, classe ${frente.classe})` : "nenhum"}`,
    ].join("\n"),
  );
}

/** Janelas visíveis do app de teste. */
export function janelasVisiveis(ctx: Pick<Ctx, "helper" | "app">): Promise<JanelaInfo[]> {
  return ctx.helper.janelas({ pid: ctx.app.pid, soVisiveis: true });
}

/** A janela maior que cobre a área útil é o menu de colagem (a janela do menu ocupa o monitor e é recortada). */
export async function janelaDoMenu(ctx: Pick<Ctx, "helper" | "app">): Promise<JanelaInfo> {
  const janelas = await janelasVisiveis(ctx);
  const maior = [...janelas].sort((a, b) => b.retangulo.largura * b.retangulo.altura - a.retangulo.largura * a.retangulo.altura)[0];
  if (!maior) throw new Error("Nenhuma janela visível do app de teste: o menu não está aberto.");
  return maior;
}

/** Janela de cadastro visível (título CSTM, menor que a tela). */
export async function janelaPrincipal(ctx: Pick<Ctx, "helper" | "app">): Promise<JanelaInfo | undefined> {
  const tela = await ctx.helper.telaInfo();
  return (await janelasVisiveis(ctx)).find(
    (j) => j.titulo === "CSTM" && j.retangulo.largura >= 600 && j.retangulo.largura < tela.principal.largura - 20,
  );
}

export async function esperarJanelaPrincipal(ctx: Pick<Ctx, "helper" | "app">, visivel: boolean, limiteMs = 10_000): Promise<void> {
  await expect
    .poll(async () => (await janelaPrincipal(ctx)) !== undefined, {
      timeout: limiteMs,
      message: visivel ? "a janela de cadastro não ficou visível" : "a janela de cadastro continua visível",
    })
    .toBe(visivel);
}

/** Retângulo de um elemento da página picker em pixels físicos da tela (origem da janela do menu + CSS × escala). */
export async function retanguloNaTela(ctx: Pick<Ctx, "helper" | "app">, picker: Page, alvo: Locator): Promise<Retangulo> {
  const [caixa, escala, janela] = await Promise.all([
    alvo.boundingBox(),
    picker.evaluate(() => window.devicePixelRatio),
    janelaDoMenu(ctx),
  ]);
  if (!caixa) throw new Error("O elemento do menu não tem caixa na tela.");
  return {
    x: Math.round(janela.retangulo.x + caixa.x * escala),
    y: Math.round(janela.retangulo.y + caixa.y * escala),
    largura: Math.round(caixa.width * escala),
    altura: Math.round(caixa.height * escala),
  };
}

export type Via =
  | { tipo: "enter" }
  /** Botão de modo da linha selecionada, pelo nome acessível (ex.: "Colar sem formatação"). */
  | { tipo: "botao"; nome: string }
  | { tipo: "copiar-botao" }
  | { tipo: "ctrl-c" };

/** Abre o menu, busca o título com o teclado real e escolhe o texto pela via pedida; espera o menu fechar. */
export async function escolherNoMenu(ctx: Ctx, titulo: string, via: Via): Promise<Page> {
  const picker = await abrirMenu(ctx);
  await ctx.helper.digitar(titulo);
  const linha = picker.getByRole("listbox", { name: "Textos" }).getByRole("option").filter({ hasText: titulo }).first();
  await expect(linha, `o texto "${titulo}" não apareceu nos resultados`).toBeVisible();
  await expect(linha).toHaveAttribute("aria-selected", "true");
  switch (via.tipo) {
    case "enter":
      await ctx.helper.tecla("Enter");
      break;
    case "botao":
      await linha.getByRole("button", { name: via.nome }).click();
      break;
    case "copiar-botao":
      await linha.getByRole("button", { name: `Copiar ${titulo}` }).click();
      break;
    case "ctrl-c":
      await ctx.helper.tecla("Ctrl+C");
      break;
  }
  await esperarMenuFechado(ctx);
  return picker;
}

interface ItemDoHistorico {
  id: number;
  kind: "text" | "image";
  title: string;
  preview: string;
}

/** Títulos do histórico (fora da lixeira), do mais recente ao mais antigo, lidos pelo comando do app. */
export async function titulosDoHistorico(main: Page): Promise<string[]> {
  return (await invocar<ItemDoHistorico[]>(main, "list_clipboard_history")).map((item) => item.title);
}

export async function esperarHistorico(main: Page, esperado: string[], limiteMs = 10_000): Promise<void> {
  await expect
    .poll(() => titulosDoHistorico(main), { timeout: limiteMs, intervals: [100, 200, 400], message: "o histórico do clipboard não ficou como esperado" })
    .toEqual(esperado);
}
