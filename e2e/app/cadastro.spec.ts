import { expect, test } from "../support/fixtures";
import {
  arvore,
  esperarLinhas,
  esperarSalvo,
  linha,
  linhas,
  menuDeContexto,
  novo,
  pastasDoBanco,
  selecionadas,
  semear,
  textosDoBanco,
} from "../support/biblioteca";

test.describe("criação", () => {
  test("cria um texto pelo botão Novo e o grava automaticamente na raiz", async ({ main }) => {
    await semear(main, {});
    await novo(main, "Novo texto");
    await expect(main.getByRole("textbox", { name: "Título" })).toBeFocused();
    await main.keyboard.type("Assinatura");
    await main.keyboard.press("Enter");
    await expect(main.getByRole("textbox", { name: "Conteúdo" })).toBeFocused();
    await main.keyboard.type("Att.,");

    await expect.poll(async () => (await textosDoBanco(main)).map((t) => [t.title, t.content, t.folderId])).toEqual([
      ["Assinatura", "Att.,", null],
    ]);
    await esperarSalvo(main);
    await esperarLinhas(main, ["Assinatura"]);
  });

  test("Ctrl+N cria o texto na pasta selecionada e Ctrl+S grava na hora", async ({ main }) => {
    const ids = await semear(main, { pastas: { Trabalho: {} } });
    await linha(main, "Trabalho").click();
    await main.keyboard.press("Control+n");
    await main.keyboard.type("Resposta");
    await main.keyboard.press("Enter");
    await main.keyboard.type("Obrigado!");
    await main.keyboard.press("Control+s");

    await expect.poll(async () => (await textosDoBanco(main)).map((t) => [t.title, t.content, t.folderId])).toEqual([
      ["Resposta", "Obrigado!", ids.Trabalho],
    ]);
    await esperarLinhas(main, ["Trabalho", "  Resposta"]);
  });

  test("cria pasta, subpasta e texto dentro da subpasta pelo menu de contexto", async ({ main }) => {
    await semear(main, {});
    await novo(main, "Nova pasta");
    await main.getByRole("textbox", { name: "Nome da nova pasta" }).fill("Trabalho");
    await main.keyboard.press("Enter");
    await esperarLinhas(main, ["Trabalho"]);
    await expect(main.getByRole("textbox", { name: "Nome da pasta" })).toHaveValue("Trabalho");

    let menu = await menuDeContexto(main, "Trabalho");
    await menu.getByRole("menuitem", { name: /Nova pasta/ }).click();
    await main.getByRole("textbox", { name: "Nome da nova pasta" }).fill("E-mails");
    await main.keyboard.press("Enter");
    await esperarLinhas(main, ["Trabalho", "  E-mails"]);

    menu = await menuDeContexto(main, "E-mails");
    await menu.getByRole("menuitem", { name: /Novo texto/ }).click();
    await main.keyboard.type("Follow-up");
    await main.keyboard.press("Enter");
    await main.keyboard.type("Passando para saber.");
    await esperarLinhas(main, ["Trabalho", "  E-mails", "    Follow-up"]);

    const pastas = await pastasDoBanco(main);
    const trabalho = pastas.find((p) => p.name === "Trabalho")!;
    const emails = pastas.find((p) => p.name === "E-mails")!;
    expect(trabalho.parentId).toBeNull();
    expect(emails.parentId).toBe(trabalho.id);
    await expect.poll(async () => (await textosDoBanco(main))[0]?.folderId).toBe(emails.id);
  });

  test("Esc cancela a nova pasta", async ({ main }) => {
    await semear(main, { raiz: { Telefone: "1234" } });
    await novo(main, "Nova pasta");
    await expect(main.getByRole("textbox", { name: "Nome da nova pasta" })).toBeVisible();
    await main.keyboard.press("Escape");
    await expect(main.getByRole("textbox", { name: "Nome da nova pasta" })).toHaveCount(0);
    expect(await pastasDoBanco(main)).toHaveLength(0);
  });
});

test.describe("destino: Raiz e seleção vazia", () => {
  test("com a Raiz selecionada, Novo texto e Nova pasta criam na raiz", async ({ main }) => {
    await semear(main, { pastas: { Trabalho: { Assinatura: "Att." } } });
    await linha(main, "Raiz").click();
    await expect(main.getByRole("region", { name: "Raiz" })).toBeVisible();
    await main.getByRole("button", { name: "Novo texto aqui" }).click();
    await main.keyboard.type("Solto");
    await main.keyboard.press("Enter");
    await main.keyboard.type("conteúdo");
    await expect.poll(async () => (await textosDoBanco(main)).find((t) => t.title === "Solto")?.folderId).toBeNull();

    await linha(main, "Raiz").click();
    await main.getByRole("button", { name: "Nova subpasta" }).click();
    await main.getByRole("textbox", { name: "Nome da nova pasta" }).fill("Outra");
    await main.keyboard.press("Enter");
    await expect.poll(async () => (await pastasDoBanco(main)).find((p) => p.name === "Outra")?.parentId).toBeNull();
  });

  test("Esc tira a seleção e o texto novo vai para a raiz", async ({ main }) => {
    await semear(main, { pastas: { Trabalho: { Assinatura: "Att." } } });
    await linha(main, "Assinatura").click();
    expect(await selecionadas(main)).toEqual(["Assinatura"]);
    await arvore(main).focus();
    await main.keyboard.press("Escape");
    expect(await selecionadas(main)).toEqual([]);
    await expect(main.getByText("Selecione um texto ou uma pasta na árvore.")).toBeVisible();

    await main.keyboard.press("Control+n");
    await main.keyboard.type("Na raiz");
    await main.keyboard.press("Enter");
    await main.keyboard.type("x");
    await expect.poll(async () => (await textosDoBanco(main)).find((t) => t.title === "Na raiz")?.folderId).toBeNull();
  });

  test("clicar no espaço vazio da árvore tira a seleção", async ({ main }) => {
    await semear(main, { pastas: { Trabalho: { Assinatura: "Att." } } });
    await linha(main, "Assinatura").click();
    const caixa = (await arvore(main).boundingBox())!;
    await main.mouse.click(caixa.x + 40, caixa.y + caixa.height - 8);
    expect(await selecionadas(main)).toEqual([]);
    await expect(main.getByText("Selecione um texto ou uma pasta na árvore.")).toBeVisible();
  });

  test("clique direito no espaço vazio oferece Novo texto e Nova pasta na raiz", async ({ main }) => {
    const ids = await semear(main, { pastas: { Trabalho: {} } });
    await linha(main, "Trabalho").click();
    const caixa = (await arvore(main).boundingBox())!;
    await main.mouse.click(caixa.x + 40, caixa.y + caixa.height - 8, { button: "right" });
    const menu = main.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /Novo texto/ })).toBeVisible();
    await menu.getByRole("menuitem", { name: /Nova pasta/ }).click();
    await main.getByRole("textbox", { name: "Nome da nova pasta" }).fill("Na raiz");
    await main.keyboard.press("Enter");
    await expect.poll(async () => (await pastasDoBanco(main)).find((p) => p.name === "Na raiz")?.parentId).toBeNull();
    expect(ids.Trabalho).toBeGreaterThan(0);
  });
});

test.describe("edição, renomear e excluir", () => {
  test("edita o título e o conteúdo com gravação automática e mostra o caminho", async ({ main }) => {
    await semear(main, { pastas: { Trabalho: { Resposta: "Olá!" } } });
    await linha(main, "Resposta").click();
    await expect(main.getByRole("navigation", { name: "Caminho" }).getByRole("button", { name: "Trabalho" })).toBeVisible();

    await main.getByRole("textbox", { name: "Título" }).fill("Resposta padrão");
    await main.getByRole("textbox", { name: "Conteúdo" }).fill("Olá, tudo bem?");
    await expect.poll(async () => (await textosDoBanco(main))[0]).toMatchObject({
      title: "Resposta padrão",
      content: "Olá, tudo bem?",
    });
    await esperarSalvo(main);
    await esperarLinhas(main, ["Trabalho", "  Resposta padrão"]);
  });

  test("título vazio não é gravado e mantém a última versão salva", async ({ main }) => {
    await semear(main, { raiz: { Saudação: "Olá" } });
    await linha(main, "Saudação").click();
    await main.getByRole("textbox", { name: "Título" }).fill("");
    await expect(main.getByText(/O título é obrigatório/)).toBeVisible();
    await expect(main.getByRole("status", { name: "Estado do salvamento" })).toContainText("Não salvo: o título está vazio");
    expect((await textosDoBanco(main))[0].title).toBe("Saudação");
  });

  test("F2 renomeia um texto (foco no título) e uma pasta (na própria árvore)", async ({ main }) => {
    await semear(main, { pastas: { Antigo: { Assinatura: "Att." } } });

    await linha(main, "Assinatura").click();
    await arvore(main).focus();
    await main.keyboard.press("F2");
    await expect(main.getByRole("textbox", { name: "Título" })).toBeFocused();
    await main.keyboard.press("Control+a");
    await main.keyboard.type("Assinatura nova");
    await expect.poll(async () => (await textosDoBanco(main))[0].title).toBe("Assinatura nova");

    await linha(main, "Antigo").click();
    await arvore(main).focus();
    await main.keyboard.press("F2");
    const nome = main.getByRole("textbox", { name: "Novo nome da pasta" });
    await expect(nome).toBeFocused();
    await nome.fill("Novo");
    await main.keyboard.press("Enter");
    await esperarLinhas(main, ["Novo", "  Assinatura nova"]);
    expect((await pastasDoBanco(main)).map((p) => p.name)).toEqual(["Novo"]);
  });

  test("renomeia a pasta pelo campo do editor", async ({ main }) => {
    await semear(main, { pastas: { Antigo: { A: "a" } } });
    await linha(main, "Antigo").click();
    const nome = main.getByRole("textbox", { name: "Nome da pasta" });
    // Esc descarta a edição; Enter (ou sair do campo) confirma.
    await nome.fill("Descartada");
    await main.keyboard.press("Escape");
    await expect(nome).toHaveValue("Antigo");
    await nome.fill("Renomeada");
    await main.keyboard.press("Enter");
    await expect.poll(async () => (await pastasDoBanco(main)).map((p) => p.name)).toEqual(["Renomeada"]);
    await esperarLinhas(main, ["Renomeada", "  A"]);
  });

  test("Delete exclui o texto e a pasta (com o conteúdo) para a lixeira", async ({ main }) => {
    await semear(main, { pastas: { Trabalho: { Assinatura: "Att." } }, raiz: { Telefone: "1234" } });
    await linha(main, "Telefone").click();
    await arvore(main).focus();
    await main.keyboard.press("Delete");
    await esperarLinhas(main, ["Trabalho", "  Assinatura"]);
    await expect(main.getByRole("button", { name: "Lixeira, 1 item" })).toBeVisible();

    const menu = await menuDeContexto(main, "Trabalho");
    await menu.getByRole("menuitem", { name: /Excluir/ }).click();
    await esperarLinhas(main, []);
    await expect(main.getByRole("button", { name: "Lixeira, 2 itens" })).toBeVisible();
    expect(await textosDoBanco(main)).toHaveLength(0);
  });
});

test.describe("favoritos", () => {
  test("estrela do editor, estrela na linha e filtro Favoritos", async ({ main }) => {
    await semear(main, {
      pastas: { Trabalho: { Saudação: "Olá", Assinatura: "Att." } },
      raiz: { Telefone: "1234" },
    });
    await linha(main, "Saudação").click();
    const estrela = main.getByRole("button", { name: "Favorito", exact: true });
    await estrela.click();
    await expect(estrela).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await textosDoBanco(main)).filter((t) => t.favorite).map((t) => t.title)).toEqual(["Saudação"]);
    await expect(linha(main, "Saudação").getByLabel("Favorito")).toBeVisible();
    await expect(linha(main, "Assinatura").getByLabel("Favorito")).toHaveCount(0);

    await main.getByRole("button", { name: "Favoritos", exact: true }).click();
    await esperarLinhas(main, ["Trabalho", "  Saudação"]);
    await main.getByRole("button", { name: "Favoritos", exact: true }).click();
    await esperarLinhas(main, ["Trabalho", "  Saudação", "  Assinatura", "Telefone"]);

    // Desmarca de novo pela estrela do editor.
    await estrela.click();
    await expect.poll(async () => (await textosDoBanco(main)).some((t) => t.favorite)).toBe(false);
  });

  test("Adicionar aos favoritos pelo menu de contexto", async ({ main }) => {
    await semear(main, { raiz: { Telefone: "1234" } });
    const menu = await menuDeContexto(main, "Telefone");
    await menu.getByRole("menuitem", { name: /Adicionar aos favoritos/ }).click();
    await expect.poll(async () => (await textosDoBanco(main))[0].favorite).toBe(true);
  });
});

test.describe("busca", () => {
  const dados = {
    pastas: {
      Trabalho: { "Follow-up": "Passando para saber se recebeu a proposta.", Assinatura: "Att." },
    },
    raiz: { "Proposta comercial": "Segue a proposta.", Ação: "Conteúdo com acentuação", Telefone: "1234" },
  };

  test("filtra por título e por conteúdo, mantendo as pastas dos resultados", async ({ main }) => {
    await semear(main, dados);
    const busca = main.getByRole("searchbox", { name: "Buscar" });
    await busca.fill("propos");
    await esperarLinhas(main, ["Trabalho", "  Follow-up", "Proposta comercial"]);
    await expect(main.getByText("2 resultados")).toBeVisible();
    await expect(linha(main, "Follow-up").locator("mark")).toHaveText("propos");

    await busca.fill("telefone");
    await esperarLinhas(main, ["Telefone"]);

    await busca.fill("1234");
    await esperarLinhas(main, ["Telefone"]);

    await busca.fill("inexistente");
    await expect(main.getByText("Nenhum resultado.")).toBeVisible();

    await busca.fill("");
    await expect.poll(async () => (await linhas(main)).length).toBe(6);
  });

  test("a busca ignora acentos nos dois sentidos", async ({ main }) => {
    await semear(main, dados);
    const busca = main.getByRole("searchbox", { name: "Buscar" });
    await busca.fill("acao");
    await esperarLinhas(main, ["Ação"]);
    await busca.fill("ACENTUACAO");
    await esperarLinhas(main, ["Ação"]);
    await busca.fill("açã");
    await esperarLinhas(main, ["Ação"]);
  });
});

test.describe("contador de uso", () => {
  test("o editor mostra 'Ainda não usado' para um texto nunca usado", async ({ main }) => {
    await semear(main, { raiz: { Telefone: "1234" } });
    await linha(main, "Telefone").click();
    await expect(main.getByText("Ainda não usado")).toBeVisible();
  });

  // O contador só sobe por choose_snippet (cola no programa anterior) ou copy_snippet (escreve no clipboard
  // do sistema), o que a camada do app não pode fazer. A exibição de "Usado N vezes · último uso em ..." fica
  // para a camada do Windows, depois de colar pelo menu: e2e/windows/colagem.spec.ts ("o contador de uso sobe ...").
  test.fixme("o editor mostra 'Usado N vezes · último uso em dd/mm/aaaa' depois de colar", () => {});
});
