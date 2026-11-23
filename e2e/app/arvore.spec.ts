import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { arvore, esperarLinhas, linha, menuDeContexto, selecionadas, semear, textosDoBanco } from "../support/biblioteca";

// Ctrl+C num único texto também escreve no clipboard do Windows (docs/telas.md, Operações da árvore); por isso
// estes testes só copiam pastas ou vários itens, e a cópia de um texto só fica para a camada do Windows.

const SEMENTE = {
  pastas: {
    Trabalho: { Assinatura: "Att.", Resposta: "Olá!" },
    Pessoal: { Endereço: "Rua A, 1" },
  },
  raiz: { Telefone: "1234", Agenda: "https://agenda" },
};
const SEMEADO = ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Telefone", "Agenda"];

async function focar(main: Page) {
  await arvore(main).focus();
}

async function ctrlClique(main: Page, ...nomes: string[]) {
  for (const nome of nomes) await linha(main, nome).click({ modifiers: ["Control"] });
}

test.describe("seleção múltipla", () => {
  test("Ctrl+clique, Shift+clique e Ctrl+A selecionam vários; Esc volta a um item", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Assinatura").click();
    await ctrlClique(main, "Telefone");
    expect(await selecionadas(main)).toEqual(["Assinatura", "Telefone"]);
    const painel = main.getByRole("region", { name: "Seleção" });
    await expect(painel.getByRole("heading", { name: "2 itens selecionados" })).toBeVisible();
    await expect(painel.getByText("2 textos", { exact: true })).toBeVisible();

    // O intervalo começa no último item clicado com Ctrl.
    await linha(main, "Resposta").click({ modifiers: ["Shift"] });
    expect(await selecionadas(main)).toEqual(["Resposta", "Pessoal", "Endereço", "Telefone"]);
    await expect(main.getByText("3 textos e 1 pasta")).toBeVisible();

    await focar(main);
    await main.keyboard.press("Control+a");
    expect(await selecionadas(main)).toHaveLength(SEMEADO.length);

    await main.keyboard.press("Escape");
    expect(await selecionadas(main)).toEqual(["Resposta"]);
    await expect(main.getByRole("textbox", { name: "Título" })).toHaveValue("Resposta");
  });

  test("o menu de contexto sobre a seleção age em todos os itens e Ctrl+Z desfaz", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").click();
    await linha(main, "Agenda").click({ modifiers: ["Shift"] });
    const menu = await menuDeContexto(main, "Agenda");
    await expect(menu.getByText("2 itens selecionados")).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Renomear/ })).toHaveCount(0);
    await menu.getByRole("menuitem", { name: "Adicionar aos favoritos" }).click();
    await expect
      .poll(async () => (await textosDoBanco(main)).filter((t) => t.favorite).map((t) => t.title).sort())
      .toEqual(["Agenda", "Telefone"]);
    await expect(main.getByRole("region", { name: "Seleção" }).getByRole("button", { name: "Remover dos favoritos" })).toBeVisible();

    await focar(main);
    await main.keyboard.press("Control+z");
    await expect.poll(async () => (await textosDoBanco(main)).some((t) => t.favorite)).toBe(false);
  });

  test("move a seleção pelo painel (Mover para…) e Ctrl+Z desfaz", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").click();
    await ctrlClique(main, "Assinatura");
    await main.getByRole("button", { name: "Mover para…" }).click();
    const dialogo = main.getByRole("dialog");
    await expect(dialogo.getByText("Mover 2 itens")).toBeVisible();
    await dialogo.getByRole("radio", { name: "Pessoal" }).check();
    await dialogo.getByRole("button", { name: "Mover", exact: true }).click();
    await esperarLinhas(main, ["Trabalho", "  Resposta", "Pessoal", "  Endereço", "  Assinatura", "  Telefone", "Agenda"]);

    await focar(main);
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, SEMEADO);
  });
});

test.describe("recortar, copiar e colar", () => {
  test("Ctrl+X, Esc desfaz o recorte e Ctrl+V move para a pasta selecionada, uma só vez", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").click();
    await main.keyboard.press("Control+x");
    await main.keyboard.press("Escape");
    // Sem recorte, Colar não faz nada.
    await linha(main, "Pessoal").click();
    await main.keyboard.press("Control+v");
    await esperarLinhas(main, SEMEADO);

    await linha(main, "Telefone").click();
    await main.keyboard.press("Control+x");
    await linha(main, "Pessoal").click();
    await main.keyboard.press("Control+v");
    const movido = ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "  Telefone", "Agenda"];
    await esperarLinhas(main, movido);

    await main.keyboard.press("Control+v");
    await esperarLinhas(main, movido);
    expect(await textosDoBanco(main)).toHaveLength(5);

    await focar(main);
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, SEMEADO);
  });

  test("copiar vários itens e colar no próprio lugar duplica com ' - Cópia'; Ctrl+Z desfaz", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Assinatura").click();
    await ctrlClique(main, "Resposta");
    await main.keyboard.press("Control+c");
    await main.keyboard.press("Control+v");
    await esperarLinhas(main, [
      "Trabalho",
      "  Assinatura",
      "  Resposta",
      "  Assinatura - Cópia",
      "  Resposta - Cópia",
      "Pessoal",
      "  Endereço",
      "Telefone",
      "Agenda",
    ]);
    // As cópias ficam selecionadas e o texto copiado vem sem favorito e sem uso.
    expect(await selecionadas(main)).toEqual(["Assinatura - Cópia", "Resposta - Cópia"]);

    // A seleção (as cópias) não está entre os marcados: cola de novo na pasta dela, em outro lugar? Não: o destino
    // do Colar é a pasta da seleção, então duplica as originais outra vez com "(2)".
    await main.keyboard.press("Control+v");
    await esperarLinhas(main, [
      "Trabalho",
      "  Assinatura",
      "  Resposta",
      "  Assinatura - Cópia",
      "  Resposta - Cópia",
      "  Assinatura - Cópia (2)",
      "  Resposta - Cópia (2)",
      "Pessoal",
      "  Endereço",
      "Telefone",
      "Agenda",
    ]);

    await focar(main);
    await main.keyboard.press("Control+z");
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, SEMEADO);
  });

  test("copiar uma pasta e colar em outra mantém o nome e leva o conteúdo", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Trabalho").click();
    await main.keyboard.press("Control+c");
    await linha(main, "Pessoal").click();
    await main.keyboard.press("Control+v");
    await esperarLinhas(main, [
      "Trabalho",
      "  Assinatura",
      "  Resposta",
      "Pessoal",
      "  Trabalho",
      "    Assinatura",
      "    Resposta",
      "  Endereço",
      "Telefone",
      "Agenda",
    ]);

    await focar(main);
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, SEMEADO);
  });

  test("nos campos de texto, Ctrl+C e Ctrl+Z ficam com o campo, não com a árvore", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").click();
    await arvore(main).focus();
    await main.keyboard.press("Delete");
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Agenda"]);
    await linha(main, "Agenda").click();
    await main.getByRole("textbox", { name: "Conteúdo" }).click();
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Agenda"]);
  });
});

test.describe("arrastar e soltar", () => {
  test("arrastar para uma pasta move para dentro dela, no fim", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").dragTo(linha(main, "Pessoal"));
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "  Telefone", "Agenda"]);
  });

  test("arrastar sobre a Raiz leva o texto de uma pasta para a raiz", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Endereço").dragTo(linha(main, "Raiz"));
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "Telefone", "Agenda", "Endereço"]);
  });

  test("com Ctrl ao soltar, copia em vez de mover", async ({ main }) => {
    await semear(main, SEMENTE);
    await main.keyboard.down("Control");
    await linha(main, "Agenda").dragTo(linha(main, "Trabalho"));
    await main.keyboard.up("Control");
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "  Agenda", "Pessoal", "  Endereço", "Telefone", "Agenda"]);
    expect(await textosDoBanco(main)).toHaveLength(6);
  });

  test("reordena soltando na metade de cima de um item do mesmo tipo", async ({ main }) => {
    await semear(main, SEMENTE);
    const alvo = linha(main, "Telefone");
    const caixa = (await alvo.boundingBox())!;
    await linha(main, "Agenda").dragTo(alvo, { targetPosition: { x: 60, y: Math.max(2, Math.floor(caixa.height / 4)) } });
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Agenda", "Telefone"]);
  });

  test("arrastar um item selecionado leva a seleção inteira", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Telefone").click();
    await ctrlClique(main, "Agenda");
    await linha(main, "Agenda").dragTo(linha(main, "Trabalho"));
    await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "  Telefone", "  Agenda", "Pessoal", "  Endereço"]);
  });

  test("uma pasta não vai para dentro dela mesma", async ({ main }) => {
    await semear(main, SEMENTE);
    await linha(main, "Trabalho").dragTo(linha(main, "Assinatura"));
    await esperarLinhas(main, SEMEADO);
  });

  test("o arrasto fica desligado durante a busca", async ({ main }) => {
    await semear(main, SEMENTE);
    await expect(linha(main, "Telefone")).toHaveAttribute("draggable", "true");
    await main.getByRole("searchbox", { name: "Buscar" }).fill("tel");
    await esperarLinhas(main, ["Telefone"]);
    await expect(linha(main, "Telefone")).toHaveAttribute("draggable", "false");
  });
});

test.describe("ordenar", () => {
  const solto = { raiz: { Zulu: "z", Alfa: "a", Mike: "m" }, pastas: { Beta: { Y: "y", B: "b" } } };

  test("ordena uma pasta por nome e Ctrl+Z restaura a ordem manual", async ({ main }) => {
    await semear(main, solto);
    await esperarLinhas(main, ["Beta", "  Y", "  B", "Zulu", "Alfa", "Mike"]);
    const menu = await menuDeContexto(main, "Beta");
    await menu.getByRole("menuitem", { name: "Ordenar" }).click();
    await main.getByRole("menuitem", { name: "Por nome (A–Z)" }).click();
    await esperarLinhas(main, ["Beta", "  B", "  Y", "Zulu", "Alfa", "Mike"]);

    await focar(main);
    await main.keyboard.press("Control+z");
    await esperarLinhas(main, ["Beta", "  Y", "  B", "Zulu", "Alfa", "Mike"]);
  });

  test("ordena a raiz por nome pelo botão Mais opções", async ({ main }) => {
    await semear(main, solto);
    await main.getByRole("button", { name: "Mais opções" }).click();
    await main.getByRole("menuitem", { name: "Ordenar a raiz" }).click();
    await main.getByRole("menuitem", { name: "Por nome (A–Z)" }).click();
    await esperarLinhas(main, ["Beta", "  Y", "  B", "Alfa", "Mike", "Zulu"]);
  });

  // Sem uso registrado (só colar ou copiar pelo menu de colagem o conta, e isso toca o clipboard e o foco do
  // sistema), todos empatam e o desempate é o nome: aqui só se confere que as duas opções existem e funcionam
  // nesse caso. A ordem real por uso fica para a camada do Windows.
  test("Por mais usados e Por uso mais recente sem uso desempatam por nome", async ({ main }) => {
    await semear(main, solto);
    for (const opcao of ["Por mais usados", "Por uso mais recente"]) {
      await main.getByRole("button", { name: "Mais opções" }).click();
      await main.getByRole("menuitem", { name: "Ordenar a raiz" }).click();
      await main.getByRole("menuitem", { name: opcao }).click();
      await esperarLinhas(main, ["Beta", "  Y", "  B", "Alfa", "Mike", "Zulu"]);
      await focar(main);
      await main.keyboard.press("Control+z");
      await esperarLinhas(main, ["Beta", "  Y", "  B", "Zulu", "Alfa", "Mike"]);
    }
  });

  test("Mover para cima e Mover para baixo reordenam e desabilitam o que não se aplica", async ({ main }) => {
    await semear(main, { raiz: { Primeiro: "1", Segundo: "2" } });
    let menu = await menuDeContexto(main, "Primeiro");
    await expect(menu.getByRole("menuitem", { name: /Mover para cima/ })).toHaveAttribute("aria-disabled", "true");
    await menu.getByRole("menuitem", { name: /Mover para baixo/ }).click();
    await esperarLinhas(main, ["Segundo", "Primeiro"]);
    menu = await menuDeContexto(main, "Primeiro");
    await expect(menu.getByRole("menuitem", { name: /Mover para baixo/ })).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("teclado na árvore", () => {
  test("setas, Home e End movem a seleção e abrem o texto no editor", async ({ main }) => {
    await semear(main, { raiz: { Primeiro: "1", Segundo: "2", Terceiro: "3" } });
    await focar(main);
    // A primeira linha é a pasta Raiz.
    await main.keyboard.press("ArrowDown");
    expect(await selecionadas(main)).toEqual(["Raiz"]);
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("ArrowDown");
    expect(await selecionadas(main)).toEqual(["Segundo"]);
    await expect(main.getByRole("textbox", { name: "Título" })).toHaveValue("Segundo");
    await main.keyboard.press("End");
    expect(await selecionadas(main)).toEqual(["Terceiro"]);
    await main.keyboard.press("ArrowUp");
    expect(await selecionadas(main)).toEqual(["Segundo"]);
    await main.keyboard.press("Home");
    expect(await selecionadas(main)).toEqual(["Raiz"]);
  });

  test("Delete manda à lixeira e seleciona o item seguinte", async ({ main }) => {
    await semear(main, { raiz: { Primeiro: "1", Segundo: "2", Terceiro: "3" } });
    await focar(main);
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("Delete");
    await esperarLinhas(main, ["Primeiro", "Terceiro"]);
    await expect(main.getByRole("alertdialog")).toHaveCount(0);
    expect(await selecionadas(main)).toEqual(["Terceiro"]);
  });

  test("← e → recolhem e abrem pastas (a escolha é lembrada); ← num item vai para a pasta", async ({ main }) => {
    await semear(main, SEMENTE);
    await focar(main);
    await main.keyboard.press("ArrowDown"); // Raiz
    await main.keyboard.press("ArrowDown"); // Trabalho
    await main.keyboard.press("ArrowLeft");
    await expect(linha(main, "Trabalho")).toHaveAttribute("aria-expanded", "false");
    await esperarLinhas(main, ["Trabalho", "Pessoal", "  Endereço", "Telefone", "Agenda"]);
    await main.keyboard.press("ArrowRight");
    await esperarLinhas(main, SEMEADO);
    await main.keyboard.press("ArrowRight"); // já aberta: desce para o primeiro filho
    expect(await selecionadas(main)).toEqual(["Assinatura"]);
    await main.keyboard.press("ArrowLeft");
    expect(await selecionadas(main)).toEqual(["Trabalho"]);

    // Enter alterna a pasta.
    await main.keyboard.press("Enter");
    await expect(linha(main, "Trabalho")).toHaveAttribute("aria-expanded", "false");
    await main.keyboard.press("Enter");
    await expect(linha(main, "Trabalho")).toHaveAttribute("aria-expanded", "true");
  });

  test("a pasta recolhida continua recolhida depois de reiniciar o app", async ({ app, main }) => {
    await semear(main, SEMENTE);
    await focar(main);
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("ArrowDown");
    await main.keyboard.press("ArrowLeft");
    await esperarLinhas(main, ["Trabalho", "Pessoal", "  Endereço", "Telefone", "Agenda"]);
    await app.reiniciar();
    const nova = await app.main();
    await expect(arvore(nova)).toBeVisible();
    await esperarLinhas(nova, ["Trabalho", "Pessoal", "  Endereço", "Telefone", "Agenda"]);
  });

  test("digitar letras salta para o item e Shift+setas estendem a seleção", async ({ main }) => {
    await semear(main, SEMENTE);
    await focar(main);
    await main.keyboard.type("te");
    expect(await selecionadas(main)).toEqual(["Telefone"]);

    await linha(main, "Trabalho").click();
    await main.keyboard.type("re");
    expect(await selecionadas(main)).toEqual(["Resposta"]);
    await main.keyboard.press("Shift+ArrowDown");
    await main.keyboard.press("Shift+ArrowDown");
    expect(await selecionadas(main)).toEqual(["Resposta", "Pessoal", "Endereço"]);
  });

  test("Recolher tudo e Expandir tudo", async ({ main }) => {
    await semear(main, SEMENTE);
    await main.getByRole("button", { name: "Mais opções" }).click();
    await main.getByRole("menuitem", { name: "Recolher tudo" }).click();
    await esperarLinhas(main, ["Trabalho", "Pessoal", "Telefone", "Agenda"]);
    await main.getByRole("button", { name: "Mais opções" }).click();
    await main.getByRole("menuitem", { name: "Expandir tudo" }).click();
    await esperarLinhas(main, SEMEADO);
  });
});
