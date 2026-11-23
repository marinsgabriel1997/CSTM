import { arvore, esperarLinhas, invocar, linha, semear, textosDoBanco } from "../support/biblioteca";
import {
  abrirMenu,
  desligarHistorico,
  escolherNoMenu,
  esperarAlvo,
  esperarClipboardTexto,
  esperarMenuFechado,
  focarAlvo,
  garantirAlvoVazio,
  janelaPrincipal,
} from "../support/windows/cenario";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Colagem de verdade (Ctrl+V simulado pelo app) na janela alvo, nos quatro modos, e o que fica no clipboard.
test.skip(ENSAIO, "ensaio: só o setup roda");

const NOTA = "Veja **negrito** em [site](https://a.com)";
const COMO_MARKDOWN = NOTA;
const COMO_TEXTO = "Veja negrito em https://a.com";
const COMO_CHAT = "Veja *negrito* em https://a.com";

test.beforeEach(async ({ main }) => {
  await semear(main, { raiz: { Nota: NOTA, Outra: "Segundo texto", Terceira: "Terceiro texto" } });
  await desligarHistorico(main);
});

test("Enter cola no modo padrão (Markdown) e o texto fica no clipboard, sem HTML", async ({ ctx }) => {
  const { helper } = ctx;
  await passo("Enter no texto Nota", () => escolherNoMenu(ctx, "Nota", { tipo: "enter" }));
  await passo("o alvo recebeu o markdown como está", () => esperarAlvo(helper, COMO_MARKDOWN));
  await passo("o clipboard tem o mesmo texto e nenhum HTML", async () => {
    await esperarClipboardTexto(helper, COMO_MARKDOWN);
    const resumo = await helper.clipResumo();
    expect(resumo.html, "o modo Markdown não deve gravar HTML").toBe(false);
  });
});

test("botões de modo: Sem formatação, Google Chat e Formatado", async ({ ctx }) => {
  const { helper } = ctx;
  await passo("Sem formatação: o link vira o endereço", async () => {
    await escolherNoMenu(ctx, "Nota", { tipo: "botao", nome: "Colar sem formatação" });
    await esperarAlvo(helper, COMO_TEXTO);
    await esperarClipboardTexto(helper, COMO_TEXTO);
    expect((await helper.clipResumo()).html).toBe(false);
  });
  await passo("Google Chat: negrito com um asterisco", async () => {
    await focarAlvo(ctx);
    await escolherNoMenu(ctx, "Nota", { tipo: "botao", nome: "Colar para o Google Chat" });
    await esperarAlvo(helper, COMO_CHAT);
    await esperarClipboardTexto(helper, COMO_CHAT);
  });
  await passo("Formatado: o clipboard leva o HTML com negrito e link, e o texto de reserva", async () => {
    await focarAlvo(ctx);
    await escolherNoMenu(ctx, "Nota", { tipo: "botao", nome: "Colar formatado" });
    await expect
      .poll(() => helper.clipHtmlFragmento(), { timeout: 5_000, message: "o clipboard não recebeu o HTML" })
      .toContain("<strong>negrito</strong>");
    expect(await helper.clipHtmlFragmento()).toContain('<a href="https://a.com">site</a>');
    const reserva = await helper.clipTexto();
    expect(reserva, "o texto de reserva não deve ter marcação").not.toContain("**");
    await esperarAlvo(helper, reserva ?? "");
    expect(reserva).toContain("Veja negrito em");
  });
});

test("o modo padrão das Configurações vale no Enter e o markdown vira botão", async ({ ctx, main }) => {
  const { helper } = ctx;
  await invocar(main, "set_paste_format", { format: "plain" });
  await passo("Enter cola sem formatação", async () => {
    await escolherNoMenu(ctx, "Nota", { tipo: "enter" });
    await esperarAlvo(helper, COMO_TEXTO);
  });
  await passo("o botão Colar como markdown cola o fonte", async () => {
    await focarAlvo(ctx);
    await escolherNoMenu(ctx, "Nota", { tipo: "botao", nome: "Colar como markdown" });
    await esperarAlvo(helper, COMO_MARKDOWN);
  });
});

test("Copiar (botão) e Ctrl+C no menu: nada é colado e o clipboard fica com o texto", async ({ ctx }) => {
  const { helper } = ctx;
  await passo("clipboard com um valor anterior", async () => {
    await helper.clipEscrever({ texto: "valor anterior" });
    await esperarClipboardTexto(helper, "valor anterior");
  });
  await passo("botão Copiar", async () => {
    await escolherNoMenu(ctx, "Nota", { tipo: "copiar-botao" });
    await esperarClipboardTexto(helper, COMO_MARKDOWN);
    await garantirAlvoVazio(helper);
  });
  await passo("Ctrl+C (com outro valor no clipboard antes)", async () => {
    await helper.clipEscrever({ texto: "outro valor" });
    await escolherNoMenu(ctx, "Outra", { tipo: "ctrl-c" });
    await esperarClipboardTexto(helper, "Segundo texto");
    await garantirAlvoVazio(helper);
  });
});

test("o contador de uso sobe ao colar e copiar, e Mais usados lista pelo uso", async ({ ctx, main }) => {
  test.setTimeout(100_000);
  const { helper } = ctx;
  const usos = async () => Object.fromEntries((await textosDoBanco(main)).map((t) => [t.title, t.useCount]));
  await passo("colar Nota duas vezes e Outra uma vez; copiar Terceira", async () => {
    await escolherNoMenu(ctx, "Nota", { tipo: "enter" });
    await esperarAlvo(helper, COMO_MARKDOWN);
    await escolherNoMenu(ctx, "Nota", { tipo: "enter" });
    await escolherNoMenu(ctx, "Outra", { tipo: "enter" });
    await escolherNoMenu(ctx, "Terceira", { tipo: "ctrl-c" });
  });
  await passo("os contadores do banco", async () => {
    await expect.poll(usos, { timeout: 10_000, message: "o contador de uso não subiu" }).toMatchObject({ Nota: 2, Outra: 1, Terceira: 1 });
  });
  await passo("o editor mostra Usado N vezes e o último uso", async () => {
    await main.reload();
    await arvore(main).waitFor();
    await linha(main, "Nota").click();
    await expect(main.getByText(/Usado 2 vezes · último uso em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    await linha(main, "Outra").click();
    await expect(main.getByText(/Usado 1 vez · último uso em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });
  await passo("o menu lista Mais usados, do mais para o menos usado", async () => {
    const picker = await abrirMenu(ctx);
    await expect(picker.getByRole("option", { name: "Mais usados" })).toHaveAttribute("aria-selected", "true");
    await helper.tecla("Right");
    const coluna = picker.getByRole("listbox", { name: "Mais usados" });
    await expect
      .poll(() => coluna.getByRole("option").evaluateAll((itens) => itens.map((el) => (el as HTMLElement).innerText.split("\n")[0].trim())))
      .toEqual(["Nota", "Terceira", "Outra"]);
    await helper.tecla("Esc");
    await esperarMenuFechado(ctx);
  });
});

test("ordenar a Raiz por mais usados e por uso recente com o uso real", async ({ ctx, main }) => {
  test.setTimeout(100_000);
  await passo("Outra duas vezes, depois Nota uma vez (a mais recente)", async () => {
    await escolherNoMenu(ctx, "Outra", { tipo: "enter" });
    await escolherNoMenu(ctx, "Outra", { tipo: "enter" });
    await escolherNoMenu(ctx, "Nota", { tipo: "enter" });
    await expect
      .poll(async () => (await textosDoBanco(main)).filter((t) => t.useCount > 0).length, { timeout: 10_000 })
      .toBe(2);
  });
  const ordenar = async (opcao: string) => {
    await main.reload();
    await arvore(main).waitFor();
    await main.getByRole("button", { name: "Mais opções" }).click();
    await main.getByRole("menuitem", { name: "Ordenar a raiz" }).click();
    await main.getByRole("menuitem", { name: opcao }).click();
  };
  await passo("Por mais usados: Outra, Nota, Terceira", async () => {
    await ordenar("Por mais usados");
    await esperarLinhas(main, ["Outra", "Nota", "Terceira"]);
  });
  await passo("Por uso mais recente: Nota, Outra, Terceira", async () => {
    await ordenar("Por uso mais recente");
    await esperarLinhas(main, ["Nota", "Outra", "Terceira"]);
  });
});

test("Ctrl+C de um texto único na árvore do cadastro escreve o conteúdo no clipboard", async ({ ctx, main }) => {
  const { helper } = ctx;
  await passo("clipboard com um valor anterior", async () => {
    await helper.clipEscrever({ texto: "valor anterior" });
    await esperarClipboardTexto(helper, "valor anterior");
  });
  await passo("trazer a janela de cadastro ao primeiro plano e selecionar o texto", async () => {
    const principal = await janelaPrincipal(ctx);
    expect(principal, "a janela de cadastro não está visível").toBeDefined();
    expect(await helper.janelaFocar(principal!.hwnd), "a janela de cadastro não ficou em primeiro plano").toBe(true);
    await linha(main, "Outra").click();
    await arvore(main).focus();
  });
  await passo("Ctrl+C real", async () => {
    expect(await helper.esperarModificadoresSoltos()).toBe(true);
    await helper.tecla("Ctrl+C");
    await esperarClipboardTexto(helper, "Segundo texto");
  });
});
