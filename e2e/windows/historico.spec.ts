import type { Page } from "@playwright/test";
import { arvore, semear } from "../support/biblioteca";
import { abrirPagina, desmarcar, marcar } from "../support/paginas";
import {
  abrirMenu,
  esperar,
  esperarAlvo,
  esperarClipboardTexto,
  esperarHistorico,
  esperarMenuFechado,
  escolherNoMenu,
  garantirPor,
  menuVisivel,
  focarAlvo,
  titulosDoHistorico,
} from "../support/windows/cenario";
import type { HelperWindows } from "../support/windows/helper";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Histórico do clipboard: o helper escreve no clipboard como "outro programa" e o app (com o histórico ligado, o padrão) o guarda.
test.skip(ENSAIO, "ensaio: só o setup roda");

/** Escreve no clipboard e espera o item novo aparecer no topo do histórico (um por vez, para o monitor ver cada escrita). */
async function copiarNoutroPrograma(
  helper: HelperWindows,
  main: Page,
  conteudo: Parameters<HelperWindows["clipEscrever"]>[0],
  titulos: string[],
): Promise<void> {
  await helper.clipEscrever(conteudo);
  await esperarHistorico(main, titulos);
}

/** Linhas da coluna aberta do menu (primeira linha de texto de cada opção). */
const linhasDaColuna = (picker: Page, nome: string) =>
  picker
    .getByRole("listbox", { name: nome })
    .getByRole("option")
    .evaluateAll((itens) => itens.map((el) => (el as HTMLElement).innerText.split("\n")[0].trim()));

test("textos, HTML e imagem entram no Histórico, do mais recente ao mais antigo, no menu e no cadastro", async ({ ctx, main }) => {
  const { helper } = ctx;
  await passo("copiar um texto, um texto com HTML e uma imagem", async () => {
    await copiarNoutroPrograma(helper, main, { texto: "Primeiro texto" }, ["Primeiro texto"]);
    await copiarNoutroPrograma(helper, main, { texto: "Segundo rico", html: "Segundo <b>rico</b>" }, ["Segundo rico", "Primeiro texto"]);
    await copiarNoutroPrograma(helper, main, { imagem: { largura: 50, altura: 40, cor: "#2D7DD2" } }, [
      "Imagem 50 × 40",
      "Segundo rico",
      "Primeiro texto",
    ]);
  });
  await passo("o cadastro mostra a pasta Histórico com os itens na mesma ordem", async () => {
    const pasta = arvore(main).getByRole("treeitem", { name: "Histórico", exact: true });
    await expect(pasta).toBeVisible();
    await pasta.click();
    await main.keyboard.press("ArrowRight");
    await expect(arvore(main).getByRole("treeitem", { name: /^(Imagem 50 × 40|Segundo rico|Primeiro texto)$/ })).toHaveText([/Imagem 50 × 40/, /Segundo rico/, /Primeiro texto/]);
  });
  const picker = await passo("o menu tem a pasta Histórico no topo", async () => {
    const aberto = await abrirMenu(ctx);
    await expect(aberto.getByRole("option", { name: "Histórico" })).toHaveAttribute("aria-selected", "true");
    return aberto;
  });
  await passo("→ abre o Histórico, do mais recente ao mais antigo", async () => {
    await helper.tecla("Right");
    await expect.poll(() => linhasDaColuna(picker, "Histórico")).toEqual(["Imagem 50 × 40", "Segundo rico", "Primeiro texto"]);
  });
  await passo("a imagem selecionada mostra o cartão de preview com o tamanho", async () => {
    await expect(picker.getByRole("img", { name: "Imagem 50 × 40" })).toBeVisible();
    await expect(picker.getByText("50 × 40", { exact: true })).toBeVisible();
    await helper.tecla("Down");
    await expect(picker.getByRole("img", { name: "Imagem 50 × 40" })).toHaveCount(0);
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
});

test("colar do Histórico leva os formatos; o item usado sobe para o topo", async ({ ctx, main }) => {
  test.setTimeout(100_000);
  const { helper } = ctx;
  await passo("histórico com dois itens (o mais antigo é o texto com HTML)", async () => {
    await copiarNoutroPrograma(helper, main, { texto: "Item rico", html: "Item <b>rico</b>" }, ["Item rico"]);
    await copiarNoutroPrograma(helper, main, { texto: "Item simples" }, ["Item simples", "Item rico"]);
  });
  const colar = async (posicao: number) => {
    const picker = await abrirMenu(ctx);
    await helper.tecla("Right");
    await expect(picker.getByRole("listbox", { name: "Histórico" }).getByRole("option")).toHaveCount(2);
    for (let i = 0; i < posicao; i++) await helper.tecla("Down");
    await helper.tecla("Enter");
    await esperarMenuFechado(ctx);
  };
  await passo("Enter no segundo item (com HTML) cola o texto e deixa o HTML no clipboard", async () => {
    await colar(1);
    await esperarAlvo(helper, "Item rico");
    await expect.poll(() => helper.clipHtmlFragmento(), { timeout: 5_000, message: "o HTML do item não foi para o clipboard" }).toBe("Item <b>rico</b>");
    await esperarHistorico(main, ["Item rico", "Item simples"]);
  });
  await passo("usar o outro item o sobe de novo", async () => {
    await focarAlvo(ctx);
    await colar(1);
    await esperarAlvo(helper, "Item simples");
    await esperarHistorico(main, ["Item simples", "Item rico"]);
  });
});

test("colar uma imagem do Histórico deixa a imagem no clipboard", async ({ ctx, main }) => {
  const { helper } = ctx;
  await copiarNoutroPrograma(helper, main, { imagem: { largura: 50, altura: 40 } }, ["Imagem 50 × 40"]);
  await helper.clipEscrever({ texto: "outra coisa" });
  await esperarClipboardTexto(helper, "outra coisa");
  await passo("Enter no item de imagem", async () => {
    const picker = await abrirMenu(ctx);
    await helper.tecla("Right");
    await expect(picker.getByRole("listbox", { name: "Histórico" }).getByRole("option")).toHaveCount(2);
    // A imagem é o mais antigo; "outra coisa" entrou depois e ficou no topo.
    await helper.tecla("Down");
    await helper.tecla("Enter");
    await esperarMenuFechado(ctx);
  });
  await passo("o clipboard tem a imagem 50 × 40", async () => {
    await expect.poll(async () => (await helper.clipResumo()).imagem, { timeout: 5_000 }).toMatchObject({ largura: 50, altura: 40 });
  });
});

test("copiar de novo algo já guardado o sobe sem repetir", async ({ ctx, main }) => {
  const { helper } = ctx;
  await copiarNoutroPrograma(helper, main, { texto: "Alfa" }, ["Alfa"]);
  await copiarNoutroPrograma(helper, main, { texto: "Beta" }, ["Beta", "Alfa"]);
  await passo("copiar Alfa de novo", async () => {
    await copiarNoutroPrograma(helper, main, { texto: "Alfa" }, ["Alfa", "Beta"]);
  });
});

test("Delete no menu manda o item para a Lixeira e Restaurar no cadastro o devolve", async ({ ctx, main }) => {
  const { helper } = ctx;
  await copiarNoutroPrograma(helper, main, { texto: "Um" }, ["Um"]);
  await copiarNoutroPrograma(helper, main, { texto: "Dois" }, ["Dois", "Um"]);
  await copiarNoutroPrograma(helper, main, { texto: "Tres" }, ["Tres", "Dois", "Um"]);
  const picker = await passo("abrir o Histórico no menu", async () => {
    const aberto = await abrirMenu(ctx);
    await helper.tecla("Right");
    await expect(aberto.getByRole("listbox", { name: "Histórico" }).getByRole("option")).toHaveCount(3);
    return aberto;
  });
  await passo("Delete (cursor no fim da busca) exclui o primeiro item sem fechar o menu", async () => {
    await helper.tecla("Delete");
    await esperarHistorico(main, ["Dois", "Um"]);
    await expect.poll(() => linhasDaColuna(picker, "Histórico")).toEqual(["Dois", "Um"]);
    expect(await menuVisivel(ctx), "o menu deveria seguir aberto").toBe(true);
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
  await passo("a Lixeira do cadastro tem o item e Restaurar o devolve ao topo", async () => {
    await main.reload();
    await arvore(main).waitFor();
    await main.getByRole("button", { name: "Lixeira, 1 item" }).click();
    const itens = main.getByRole("listbox", { name: "Itens na lixeira" });
    await itens.getByRole("option", { name: "Tres" }).click();
    await itens.getByRole("button", { name: "Restaurar “Tres”" }).click();
    await esperarHistorico(main, ["Tres", "Dois", "Um"]);
  });
});

test("desligar o histórico para de guardar e Limpar histórico pede confirmação", async ({ ctx, main }) => {
  const { helper } = ctx;
  await copiarNoutroPrograma(helper, main, { texto: "Guardado" }, ["Guardado"]);
  await abrirPagina(main, "Configurações");
  const opcao = main.getByRole("switch", { name: "Guardar o histórico da área de transferência" });
  await passo("desligado: uma cópia nova não entra", async () => {
    await desmarcar(opcao);
    await helper.clipEscrever({ texto: "Ignorado" });
    await garantirPor(1_500, async () => (await titulosDoHistorico(main)).join("|") === "Guardado", "o histórico guardou com a opção desligada");
  });
  await passo("ligado de novo: volta a guardar", async () => {
    await marcar(opcao);
    await copiarNoutroPrograma(helper, main, { texto: "Novo" }, ["Novo", "Guardado"]);
  });
  await passo("Limpar histórico: Cancelar mantém, Limpar apaga", async () => {
    const limpar = main.getByRole("button", { name: "Limpar histórico" });
    await limpar.click();
    await expect(main.getByText(/Apagar os 2 itens do histórico\?/)).toBeVisible();
    await main.getByRole("button", { name: "Cancelar" }).click();
    expect(await titulosDoHistorico(main)).toHaveLength(2);
    await limpar.click();
    await main.getByRole("button", { name: "Limpar", exact: true }).click();
    await expect(main.getByText("Histórico limpo.")).toBeVisible();
    await esperarHistorico(main, []);
  });
});

test("o que é marcado como sensível e o que o próprio CSTM escreve não entram no histórico", async ({ ctx, main }) => {
  const { helper } = ctx;
  await semear(main, { raiz: { Nota: "Texto da nota" } });
  await passo("item sensível (ExcludeClipboardContentFromMonitorProcessing) e depois um normal", async () => {
    await helper.clipEscrever({ texto: "segredo-123", sensivel: true });
    await esperar(300);
    await copiarNoutroPrograma(helper, main, { texto: "Sentinela um" }, ["Sentinela um"]);
  });
  await passo("colar e copiar um texto cadastrado (escritas do próprio CSTM) e depois um item normal", async () => {
    await escolherNoMenu(ctx, "Nota", { tipo: "enter" });
    await esperarAlvo(helper, "Texto da nota");
    await escolherNoMenu(ctx, "Nota", { tipo: "ctrl-c" });
    await esperar(500);
    await copiarNoutroPrograma(helper, main, { texto: "Sentinela dois" }, ["Sentinela dois", "Sentinela um"]);
  });
  expect(await titulosDoHistorico(main)).not.toContain("segredo-123");
  expect(await titulosDoHistorico(main)).not.toContain("Texto da nota");
});
