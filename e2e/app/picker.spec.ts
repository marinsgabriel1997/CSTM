import { expect, test } from "../support/fixtures";
import { abrirMenu, linhaSelecionada, linhasDoMenu } from "../support/picker";
import { invocar } from "../support/biblioteca";

// O menu de colagem sem o atalho global: ver support/picker.ts para o que isso permite e o que não permite.

const BIBLIOTECA = {
  pastas: {
    Trabalho: { Assinatura: "Att., Gabriel", Resposta: "Obrigado pelo contato." },
    Pessoal: { Endereço: "Rua A, 10" },
    Vazia: {},
  },
  raiz: { Telefone: "1234" },
};

test("lista Mais usados, Favoritos, as pastas e os textos da raiz", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, BIBLIOTECA);
  // Sem uso nem favoritos, só as pastas e os textos.
  await expect.poll(() => linhasDoMenu(menu.picker)).toEqual(["Trabalho", "Pessoal", "Vazia", "Telefone"]);

  await invocar(main, "set_favorite", { id: menu.ids.Assinatura, favorite: true });
  await menu.usos({ [menu.ids.Resposta]: 5, [menu.ids.Telefone]: 2 });
  await menu.reabrir();
  await expect.poll(() => linhasDoMenu(menu.picker)).toEqual(["Mais usados", "Favoritos", "Trabalho", "Pessoal", "Vazia", "Telefone"]);
  // A primeira linha já vem selecionada, e a busca mantém o foco.
  await expect(linhaSelecionada(menu.picker)).toContainText("Mais usados");
  await expect(menu.picker.getByRole("combobox", { name: "Buscar" })).toBeFocused();
});

test("sem textos cadastrados o menu oferece abrir o cadastro", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, {});
  await expect(menu.picker.getByText("Nenhum texto cadastrado.")).toBeVisible();
  await expect(menu.picker.getByRole("button", { name: "Abrir cadastro" })).toBeVisible();
});

test.describe("clicar para abrir", () => {
  test("Favoritos, Mais usados e pastas abrem na própria coluna, com o botão de voltar", async ({ app, main }) => {
    const menu = await abrirMenu(app, main, BIBLIOTECA, { navegacao: "click" });
    await invocar(main, "set_favorite", { id: menu.ids.Assinatura, favorite: true });
    await invocar(main, "set_favorite", { id: menu.ids.Telefone, favorite: true });
    await menu.usos({ [menu.ids.Resposta]: 5 });
    await menu.reabrir();
    const { picker } = menu;

    await picker.getByRole("option", { name: "Favoritos" }).click();
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura | Trabalho", "Telefone"]);
    await picker.getByRole("button", { name: "Favoritos" }).click();
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Mais usados", "Favoritos", "Trabalho", "Pessoal", "Vazia", "Telefone"]);

    await picker.getByRole("option", { name: "Mais usados" }).click();
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Resposta | Trabalho"]);
    await picker.getByRole("button", { name: "Mais usados" }).click();

    await picker.getByRole("option", { name: "Trabalho" }).click();
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura", "Resposta"]);
    await picker.getByRole("button", { name: "Trabalho" }).click();
    await picker.getByRole("option", { name: "Vazia" }).click();
    await expect(picker.getByText("Pasta vazia.")).toBeVisible();
  });

  test("teclado: ↑ ↓ movem, → abre a pasta, ← volta e Esc fecha o menu", async ({ app, main }) => {
    const menu = await abrirMenu(app, main, BIBLIOTECA, { navegacao: "click" });
    const { picker } = menu;
    const busca = picker.getByRole("combobox", { name: "Buscar" });
    await expect(linhaSelecionada(picker)).toContainText("Trabalho");

    await busca.press("ArrowDown");
    await expect(linhaSelecionada(picker)).toContainText("Pessoal");
    await busca.press("ArrowDown");
    await busca.press("ArrowDown");
    await expect(linhaSelecionada(picker)).toContainText("Telefone");
    // No fim da lista, ↓ não passa do último.
    await busca.press("ArrowDown");
    await expect(linhaSelecionada(picker)).toContainText("Telefone");
    await busca.press("ArrowUp");
    await busca.press("ArrowUp");
    await expect(linhaSelecionada(picker)).toContainText("Pessoal");

    await busca.press("ArrowRight");
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Endereço"]);
    await expect(picker.getByRole("button", { name: "Pessoal" })).toBeVisible();
    await busca.press("ArrowLeft");
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Trabalho", "Pessoal", "Vazia", "Telefone"]);

    await busca.press("Escape");
    await expect.poll(async () => (await menu.chamadas()).some((c) => c.comando === "hide_picker")).toBe(true);
  });
});

test("busca com foco automático mostra os resultados com a pasta de cada texto", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, BIBLIOTECA);
  const { picker } = menu;
  const busca = picker.getByRole("combobox", { name: "Buscar" });
  await expect(busca).toBeFocused();

  // Digitar já busca, sem clicar antes.
  await picker.keyboard.type("ass");
  await expect(busca).toHaveValue("ass");
  await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura | Trabalho"]);

  // A busca casa o começo das palavras do título e do texto.
  await busca.fill("r");
  await expect.poll(async () => (await linhasDoMenu(picker)).sort()).toEqual(["Endereço | Pessoal", "Resposta | Trabalho"]);

  await busca.fill("zzz");
  await expect(picker.getByText("Nenhum texto encontrado.")).toBeVisible();

  await busca.fill("");
  await expect.poll(() => linhasDoMenu(picker)).toEqual(["Trabalho", "Pessoal", "Vazia", "Telefone"]);
});

test("abrir o menu de novo volta à raiz e limpa a busca", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, BIBLIOTECA, { navegacao: "click" });
  const { picker } = menu;
  await picker.getByRole("option", { name: "Trabalho" }).click();
  await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura", "Resposta"]);
  await picker.getByRole("combobox", { name: "Buscar" }).fill("res");
  await expect.poll(() => linhasDoMenu(picker)).toEqual(["Resposta | Trabalho"]);

  await menu.reabrir();
  await expect(picker.getByRole("combobox", { name: "Buscar" })).toHaveValue("");
  await expect.poll(() => linhasDoMenu(picker)).toEqual(["Trabalho", "Pessoal", "Vazia", "Telefone"]);
});

test("a navegação por teclado na raiz funciona no modo cascata (padrão) e Esc fecha", async ({ app, main }) => {
  expect(await invocar(main, "get_picker_navigation")).toBe("cascade");
  const menu = await abrirMenu(app, main, BIBLIOTECA);
  const { picker } = menu;
  const busca = picker.getByRole("combobox", { name: "Buscar" });
  await expect(linhaSelecionada(picker)).toContainText("Trabalho");
  await busca.press("ArrowDown");
  await expect(linhaSelecionada(picker)).toContainText("Pessoal");
  await busca.press("End");
  await expect(linhaSelecionada(picker)).toContainText("Telefone");
  await busca.press("Home");
  await expect(linhaSelecionada(picker)).toContainText("Trabalho");
  await busca.press("Escape");
  await expect.poll(async () => (await menu.chamadas()).filter((c) => c.comando === "hide_picker")).toHaveLength(1);
});

test.describe("botões dos modos de colagem na linha selecionada", () => {
  const TODOS = ["Colar como markdown", "Colar sem formatação", "Colar formatado", "Colar para o Google Chat"];

  for (const [modo, padrao] of [
    ["markdown", "Colar como markdown"],
    ["plain", "Colar sem formatação"],
    ["rich", "Colar formatado"],
    ["chat", "Colar para o Google Chat"],
  ] as const) {
    test(`com o modo padrão ${modo}: os outros três aparecem só na linha selecionada (sem clicar)`, async ({ app, main }) => {
      const menu = await abrirMenu(app, main, BIBLIOTECA, { navegacao: "click", modo });
      const { picker } = menu;
      await picker.getByRole("option", { name: "Trabalho" }).click();
      await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura", "Resposta"]);

      const selecionada = linhaSelecionada(picker);
      await expect(selecionada).toContainText("Assinatura");
      for (const titulo of TODOS) {
        await expect(selecionada.getByRole("button", { name: titulo })).toHaveCount(titulo === padrao ? 0 : 1);
      }
      await expect(selecionada.getByRole("button", { name: "Copiar Assinatura" })).toBeVisible();

      // A outra linha não mostra os botões, e eles passam para a linha que for selecionada.
      const outra = picker.getByRole("option", { name: /Resposta/ });
      await expect(outra.getByRole("button")).toHaveCount(0);
      await picker.getByRole("combobox", { name: "Buscar" }).press("ArrowDown");
      await expect(linhaSelecionada(picker)).toContainText("Resposta");
      await expect(linhaSelecionada(picker).getByRole("button", { name: "Copiar Resposta" })).toBeVisible();
      await expect(picker.getByRole("option", { name: /Assinatura/ }).getByRole("button")).toHaveCount(0);

      // Nada foi colado nem copiado: a página não chamou os comandos que escrevem no clipboard.
      expect((await menu.chamadas()).filter((c) => /^(choose|copy|paste)_/.test(c.comando))).toEqual([]);
    });
  }
});

// Estes dois dependem de o backend ter aberto o menu (picker::show, só pelo atalho global). Sem isso o
// layout_picker responde "o menu de colagem ainda não foi aberto" e nenhuma coluna da cascata aparece:
// passar o mouse numa pasta no modo "Abrir ao passar o mouse" mostra só essa mensagem de erro.
// Ficam para a camada do Windows: e2e/windows/atalho-e-menu.spec.ts (cascata com o mouse e o teclado reais).
test.fixme("cascata: passar o mouse numa pasta abre a coluna ao lado", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, BIBLIOTECA);
  await menu.picker.getByRole("option", { name: "Trabalho" }).hover();
  await expect(menu.picker.getByRole("listbox", { name: "Trabalho" })).toBeVisible();
});

test.fixme("cascata: → abre a coluna da pasta, ← fecha e volta à pasta de origem", async ({ app, main }) => {
  const menu = await abrirMenu(app, main, BIBLIOTECA);
  await menu.picker.getByRole("combobox", { name: "Buscar" }).press("ArrowRight");
  await expect(menu.picker.getByRole("listbox", { name: "Trabalho" })).toBeVisible();
});
