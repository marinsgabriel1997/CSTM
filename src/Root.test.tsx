// Pasta virtual Raiz da árvore (plano 089): linha, recolher, editor, destino do Novo, soltar,
// seleção vazia (clique no vazio e Esc) e menus de criação.
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "./api";
import App from "./App";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  localStorage.clear();
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

function renderApp() {
  return render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>,
  );
}

function treeElement() {
  return screen.getByRole("tree", { name: "Biblioteca" });
}

function tree() {
  return within(treeElement());
}

function row(name: string) {
  return tree().getByRole("treeitem", { name });
}

/** Linhas da árvore, incluindo a Raiz, com a indentação do nível como prefixo. */
function treeRows() {
  return tree()
    .getAllByRole("treeitem")
    .map((item) => `${"  ".repeat(Number(item.getAttribute("aria-level")) - 1)}${item.getAttribute("aria-label")}`);
}

function selectedRows() {
  return tree()
    .queryAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.getAttribute("aria-label"));
}

function focusTree() {
  treeElement().focus();
}

async function contextMenu(element: Element) {
  fireEvent.contextMenu(element);
  return within(await screen.findByRole("menu"));
}

/** Trabalho (Assinatura, Resposta), Pessoal e, na raiz, Telefone e Agenda. */
async function seed() {
  const work = await fake.api.createFolder(null, "Trabalho");
  const personal = await fake.api.createFolder(null, "Pessoal");
  await fake.api.createSnippet(work.id, "Assinatura", "Att.");
  await fake.api.createSnippet(work.id, "Resposta", "Olá!");
  await fake.api.createSnippet(null, "Telefone", "1234");
  await fake.api.createSnippet(null, "Agenda", "https://agenda");
  return { work, personal };
}

function dragData() {
  const data = new Map<string, string>();
  return {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

function drag(type: "dragStart" | "dragOver" | "drop", element: Element, transfer: object) {
  fireEvent(element, createEvent[type](element, { dataTransfer: transfer }));
}

describe("linha da Raiz", () => {
  it("aparece abaixo do Histórico, com as pastas e os textos da raiz dentro", async () => {
    await seed();
    fake.copyElsewhere({ title: "Copiado" });
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    expect(treeRows()).toEqual([
      "Histórico",
      "Raiz",
      "  Trabalho",
      "    Assinatura",
      "    Resposta",
      "  Pessoal",
      "  Telefone",
      "  Agenda",
    ]);
  });

  it("não aparece na biblioteca vazia, que mostra o convite de primeiro uso", async () => {
    renderApp();

    expect(await screen.findByText("Nenhum texto ainda")).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "Raiz" })).toBeNull();
  });

  it("recolhe, lembra a escolha ao remontar e Expandir tudo a abre, mas Recolher tudo não mexe nela", async () => {
    const user = userEvent.setup();
    await seed();
    const { unmount } = renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    // O primeiro elemento da linha é a seta que abre e fecha.
    await user.click(row("Raiz").firstElementChild!);
    expect(treeRows()).toEqual(["Raiz"]);
    expect(JSON.parse(localStorage.getItem("cstm.preferences")!).rootCollapsed).toBe(true);

    unmount();
    renderApp();
    await tree().findByRole("treeitem", { name: "Raiz" });
    expect(treeRows()).toEqual(["Raiz"]);

    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: "Expandir tudo" }));
    expect(treeRows()).toContain("  Telefone");

    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: "Recolher tudo" }));
    expect(treeRows()).toEqual(["Raiz", "  Trabalho", "  Pessoal", "  Telefone", "  Agenda"]);
  });

  it("continua visível e aberta com a busca, mesmo recolhida", async () => {
    const user = userEvent.setup();
    await seed();
    localStorage.setItem("cstm.preferences", JSON.stringify({ rootCollapsed: true }));
    renderApp();
    await tree().findByRole("treeitem", { name: "Raiz" });
    expect(treeRows()).toEqual(["Raiz"]);

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "tel");

    await waitFor(() => expect(treeRows()).toEqual(["Raiz", "  Telefone"]));
  });

  it("não é arrastável", async () => {
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    expect(row("Raiz")).toHaveAttribute("draggable", "false");
    expect(row("Telefone")).toHaveAttribute("draggable", "true");
  });
});

describe("seleção da Raiz", () => {
  it("o Novo cria na raiz, mesmo com a Raiz selecionada depois de uma pasta", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await user.click(row("Raiz"));
    await user.click(screen.getByRole("button", { name: "Novo" }));
    expect(await screen.findByText("Na raiz")).toBeInTheDocument();
    await user.click(await screen.findByRole("menuitem", { name: /Novo texto/ }));
    await user.keyboard("Novo{Enter}Conteúdo{Control>}s{/Control}");

    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Novo")).toBeDefined());
    expect(fake.snippets.find((s) => s.title === "Novo")?.folderId).toBeNull();
  });

  it("Ctrl+clique e Shift+clique selecionam só ela, e Ctrl+A não a inclui", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    fireEvent.click(row("Raiz"), { ctrlKey: true });
    expect(selectedRows()).toEqual(["Raiz"]);

    fireEvent.click(row("Telefone"), { ctrlKey: true });
    expect(selectedRows()).toEqual(["Telefone"]);
    fireEvent.click(row("Raiz"), { shiftKey: true });
    expect(selectedRows()).toEqual(["Raiz"]);

    focusTree();
    await user.keyboard("{Control>}a{/Control}");
    expect(selectedRows()).not.toContain("Raiz");
    expect(selectedRows()).toContain("Telefone");
  });

  it("F2, Del, Shift+Del, Ctrl+X e Ctrl+C não fazem nada com ela", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Raiz" }));
    focusTree();
    await user.keyboard("{F2}");
    expect(screen.queryByRole("textbox", { name: "Novo nome da pasta" })).toBeNull();
    await user.keyboard("{Delete}");
    await user.keyboard("{Shift>}{Delete}{/Shift}");
    await user.keyboard("{Control>}x{/Control}{Control>}c{/Control}");

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fake.folders).toHaveLength(2);
    expect(fake.snippets).toHaveLength(4);
    expect(await fake.api.listTrash()).toEqual([]);
    expect(treeRows()).toContain("  Telefone");
    expect(selectedRows()).toEqual(["Raiz"]);
  });

  it("Ctrl+V com ela selecionada cola na raiz", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await user.click(row("Assinatura"));
    await user.keyboard("{Control>}x{/Control}");
    await user.click(row("Raiz"));
    await user.keyboard("{Control>}v{/Control}");

    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Assinatura")?.folderId).toBeNull());
  });
});

describe("editor da Raiz", () => {
  it("mostra o título fixo, a contagem direta e cria na raiz pelos botões", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Raiz" }));

    const editor = within(await screen.findByRole("region", { name: "Raiz" }));
    expect(editor.getByRole("heading", { name: "Raiz" })).toBeInTheDocument();
    expect(editor.queryByRole("textbox")).toBeNull();
    expect(editor.queryByRole("button", { name: /Ações|Favorito|Excluir/ })).toBeNull();
    expect(editor.getByText("2 textos · 2 pastas")).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Nova subpasta" }));
    const name = screen.getByRole("textbox", { name: "Nome da nova pasta" });
    await user.clear(name);
    await user.type(name, "Arquivo{Enter}");
    await waitFor(() => expect(fake.folders.find((f) => f.name === "Arquivo")?.parentId).toBeNull());

    await user.click(row("Raiz"));
    await user.click(screen.getByRole("button", { name: "Novo texto aqui" }));
    await user.keyboard("Lembrete{Enter}Comprar{Control>}s{/Control}");
    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Lembrete")).toBeDefined());
    expect(fake.snippets.find((s) => s.title === "Lembrete")?.folderId).toBeNull();
  });
});

describe("teclado na Raiz", () => {
  it("Home e as letras chegam a ela; → e ← abrem e fecham; Enter alterna; ← num item da raiz vai para ela", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    focusTree();
    await user.keyboard("{Home}");
    expect(selectedRows()).toEqual(["Raiz"]);

    await user.keyboard("{ArrowLeft}");
    expect(treeRows()).toEqual(["Raiz"]);
    await user.keyboard("{ArrowRight}");
    expect(treeRows()).toContain("  Telefone");
    await user.keyboard("{Enter}");
    expect(treeRows()).toEqual(["Raiz"]);
    await user.keyboard("{Enter}");

    await user.click(row("Telefone"));
    focusTree();
    await user.keyboard("{ArrowLeft}");
    expect(selectedRows()).toEqual(["Raiz"]);

    await user.click(row("Agenda"));
    focusTree();
    await user.keyboard("r");
    expect(selectedRows()).toEqual(["Raiz"]);
  });
});

describe("soltar sobre a Raiz", () => {
  it("move o texto e a pasta para a raiz", async () => {
    await seed();
    const inner = await fake.api.createFolder(1, "Interna");
    renderApp();
    await tree().findByRole("treeitem", { name: "Assinatura" });

    let transfer = dragData();
    drag("dragStart", row("Assinatura"), transfer);
    drag("dragOver", row("Raiz"), transfer);
    drag("drop", row("Raiz"), transfer);
    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Assinatura")?.folderId).toBeNull());

    transfer = dragData();
    drag("dragStart", row("Interna"), transfer);
    drag("drop", row("Raiz"), transfer);
    await waitFor(() => expect(fake.folders.find((f) => f.id === inner.id)?.parentId).toBeNull());
  });
});

describe("seleção vazia", () => {
  it("clicar no espaço vazio tira a seleção e o Novo passa a criar na raiz", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    expect(selectedRows()).toEqual(["Trabalho"]);
    await user.click(treeElement());

    expect(selectedRows()).toEqual([]);
    expect(screen.getByText("Selecione um texto ou uma pasta na árvore.")).toBeInTheDocument();
    expect(treeElement()).toHaveFocus();

    await user.keyboard("{Control>}n{/Control}");
    await user.keyboard("Solto{Enter}Texto{Control>}s{/Control}");
    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Solto")).toBeDefined());
    expect(fake.snippets.find((s) => s.title === "Solto")?.folderId).toBeNull();
  });

  it("Esc tira a seleção de um item; com recorte, o primeiro Esc só desfaz o recorte", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    focusTree();
    await user.keyboard("{Control>}x{/Control}");
    await user.keyboard("{Escape}");
    expect(selectedRows()).toEqual(["Telefone"]);

    await user.keyboard("{Escape}");
    expect(selectedRows()).toEqual([]);
    expect(treeElement()).toHaveFocus();

    // Com vários itens, volta a um item antes de tirar a seleção.
    fireEvent.click(row("Telefone"));
    fireEvent.click(row("Agenda"), { ctrlKey: true });
    expect(selectedRows()).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(selectedRows()).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(selectedRows()).toEqual([]);
  });

  it("Esc também tira a seleção da Raiz", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Raiz" }));
    focusTree();
    await user.keyboard("{Escape}");

    expect(selectedRows()).toEqual([]);
  });
});

describe("menus de criação", () => {
  it("o clique direito no espaço vazio tira a seleção e cria na raiz", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    const menu = await contextMenu(treeElement());

    expect(selectedRows()).toEqual([]);
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Novo texto", "Nova pasta"]);
    await user.click(menu.getByRole("menuitem", { name: "Nova pasta" }));
    const name = screen.getByRole("textbox", { name: "Nome da nova pasta" });
    await user.clear(name);
    await user.type(name, "Na raiz{Enter}");

    await waitFor(() => expect(fake.folders.find((f) => f.name === "Na raiz")?.parentId).toBeNull());
  });

  it("o menu de uma pasta cria dentro dela e não oferece Novo com vários itens", async () => {
    const user = userEvent.setup();
    const { work, personal } = await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Trabalho" });

    let menu = await contextMenu(row("Pessoal"));
    expect(menu.getAllByRole("menuitem")[0]).toHaveTextContent("Novo texto");
    await user.click(menu.getByRole("menuitem", { name: "Nova pasta" }));
    const name = screen.getByRole("textbox", { name: "Nome da nova pasta" });
    await user.clear(name);
    await user.type(name, "Filha{Enter}");
    await waitFor(() => expect(fake.folders.find((f) => f.name === "Filha")?.parentId).toBe(personal.id));

    menu = await contextMenu(row("Trabalho"));
    await user.click(menu.getByRole("menuitem", { name: "Novo texto" }));
    await user.keyboard("Dentro{Enter}Texto{Control>}s{/Control}");
    await waitFor(() => expect(fake.snippets.find((s) => s.title === "Dentro")?.folderId).toBe(work.id));

    fireEvent.click(row("Trabalho"));
    fireEvent.click(row("Pessoal"), { ctrlKey: true });
    menu = await contextMenu(row("Pessoal"));
    expect(menu.queryByRole("menuitem", { name: "Novo texto" })).toBeNull();
    expect(menu.queryByRole("menuitem", { name: "Nova pasta" })).toBeNull();
  });

  it("o menu da Raiz tem Novo, Colar, Ordenar e Exportar, sem as ações de item", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    const menu = await contextMenu(row("Raiz"));

    expect(menu.getAllByRole("menuitem").map((item) => item.textContent?.replace(/Ctrl\+V/, ""))).toEqual([
      "Novo texto",
      "Nova pasta",
      "Colar",
      "Ordenar",
      "Exportar",
    ]);
    expect(menu.getByRole("menuitem", { name: /Colar/ })).toHaveAttribute("aria-disabled", "true");

    await user.click(menu.getByRole("menuitem", { name: "Ordenar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Por nome (A–Z)" }));
    await waitFor(() => expect(treeRows().slice(-2)).toEqual(["  Agenda", "  Telefone"]));

    const second = await contextMenu(row("Raiz"));
    await user.click(second.getByRole("menuitem", { name: "Exportar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Backup JSON…" }));
    await waitFor(() => expect(fake.transfers).toEqual([{ command: "exportJson", items: [] }]));
  });

  it("Colar no menu da Raiz cola na raiz o que foi copiado", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Resposta" }));
    await user.keyboard("{Control>}c{/Control}");
    const menu = await contextMenu(row("Raiz"));
    await user.click(menu.getByRole("menuitem", { name: /Colar/ }));

    await waitFor(() =>
      expect(fake.snippets.filter((s) => s.title === "Resposta" && s.folderId === null)).toHaveLength(1),
    );
  });

  it("o botão ... da linha da Raiz abre o mesmo menu", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    // Os filhos de um treeitem não entram na árvore de acessibilidade: o botão é buscado pelo rótulo.
    await user.click(row("Raiz").querySelector('button[aria-label="Mais ações"]')!);

    expect(await screen.findByRole("menuitem", { name: "Novo texto" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Excluir" })).toBeNull();
  });
});
