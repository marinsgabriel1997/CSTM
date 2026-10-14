// Operações da árvore do cadastro (p67): seleção múltipla, recortar/copiar/colar, lixeira,
// desfazer, arrastar e soltar, ordenar e navegação.
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import App from "./App";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  localStorage.clear();
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

type User = ReturnType<typeof userEvent.setup>;

function renderApp() {
  render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>,
  );
}

function tree() {
  return within(screen.getByRole("tree", { name: "Biblioteca" }));
}

function row(name: string) {
  return tree().getByRole("treeitem", { name });
}

/** Nomes das linhas da árvore, na ordem da tela, com a indentação como prefixo. */
function treeRows() {
  return tree()
    .getAllByRole("treeitem")
    .map((item) => `${"  ".repeat(Number(item.getAttribute("aria-level")) - 1)}${item.getAttribute("aria-label")}`);
}

/** Linhas selecionadas na árvore. */
function selectedRows() {
  return tree()
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.getAttribute("aria-label"));
}

function focusTree() {
  screen.getByRole("tree", { name: "Biblioteca" }).focus();
}

async function openContextMenu(name: string) {
  fireEvent.contextMenu(row(name));
  return within(await screen.findByRole("menu"));
}

async function chooseMoreOption(user: User, ...path: string[]) {
  await user.click(screen.getByRole("button", { name: "Mais opções" }));
  for (const name of path) await user.click(await screen.findByRole("menuitem", { name }));
}

/** Trabalho (Assinatura, Resposta), Pessoal (Endereço) e, na raiz, Telefone e Agenda. */
async function seed() {
  const work = await fake.api.createFolder(null, "Trabalho");
  const personal = await fake.api.createFolder(null, "Pessoal");
  await fake.api.createSnippet(work.id, "Assinatura", "Att.");
  await fake.api.createSnippet(work.id, "Resposta", "Olá!");
  await fake.api.createSnippet(personal.id, "Endereço", "Rua A, 1");
  await fake.api.createSnippet(null, "Telefone", "1234");
  await fake.api.createSnippet(null, "Agenda", "https://agenda");
  return { work, personal };
}

const SEEDED = ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Telefone", "Agenda"];

describe("seleção múltipla", () => {
  it("Ctrl+clique, Shift+clique e Ctrl+A selecionam vários; Esc volta a um item", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Assinatura" }));
    await user.keyboard("{Control>}");
    await user.click(row("Telefone"));
    await user.keyboard("{/Control}");
    expect(selectedRows()).toEqual(["Assinatura", "Telefone"]);
    const panel = within(screen.getByRole("region", { name: "Seleção" }));
    expect(panel.getByRole("heading", { name: "2 itens selecionados" })).toBeInTheDocument();
    expect(panel.getByText("2 textos")).toBeInTheDocument();

    // O intervalo começa no último item clicado com Ctrl.
    await user.keyboard("{Shift>}");
    await user.click(row("Resposta"));
    await user.keyboard("{/Shift}");
    expect(selectedRows()).toEqual(["Resposta", "Pessoal", "Endereço", "Telefone"]);
    expect(screen.getByText("3 textos e 1 pasta")).toBeInTheDocument();

    focusTree();
    await user.keyboard("{Control>}a{/Control}");
    expect(selectedRows()).toHaveLength(SEEDED.length);

    await user.keyboard("{Escape}");
    expect(selectedRows()).toEqual(["Resposta"]);
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Resposta");
  });

  it("o menu de contexto sobre a seleção age em todos os itens", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{Shift>}");
    await user.click(row("Agenda"));
    await user.keyboard("{/Shift}");
    const menu = await openContextMenu("Agenda");

    expect(menu.getByText("2 itens selecionados")).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: /Renomear/ })).not.toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Mover para cima" })).not.toBeInTheDocument();
    await user.click(menu.getByRole("menuitem", { name: "Adicionar aos favoritos" }));

    await waitFor(() => expect(fake.snippets.filter((s) => s.favorite).map((s) => s.title)).toEqual(["Telefone", "Agenda"]));
    expect(within(screen.getByRole("region", { name: "Seleção" })).getByRole("button", { name: "Remover dos favoritos" }))
      .toBeInTheDocument();

    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(fake.snippets.some((s) => s.favorite)).toBe(false));
  });

  it("move a seleção pelo painel e Ctrl+Z desfaz", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{Control>}");
    await user.click(row("Assinatura"));
    await user.keyboard("{/Control}");
    await user.click(screen.getByRole("button", { name: "Mover para…" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Mover 2 itens")).toBeInTheDocument();
    await user.click(dialog.getByRole("radio", { name: "Pessoal" }));
    await user.click(dialog.getByRole("button", { name: "Mover" }));

    await waitFor(() =>
      expect(treeRows()).toEqual(["Trabalho", "  Resposta", "Pessoal", "  Endereço", "  Assinatura", "  Telefone", "Agenda"]),
    );

    focusTree();
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(treeRows()).toEqual(SEEDED));
  });

  it("exporta só os itens selecionados", async () => {
    const user = userEvent.setup();
    const { personal } = await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Pessoal" }));
    await user.keyboard("{Control>}");
    await user.click(row("Agenda"));
    await user.keyboard("{/Control}");
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Backup JSON…" }));

    await waitFor(() =>
      expect(fake.transfers).toEqual([
        { command: "exportJson", items: [{ kind: "folder", id: personal.id }, { kind: "snippet", id: 7 }] },
      ]),
    );
  });
});

describe("recortar, copiar e colar", () => {
  it("Ctrl+X esmaece os itens, Esc desfaz o recorte e Ctrl+V move para a pasta selecionada", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    const normal = row("Telefone").className;
    await user.keyboard("{Control>}x{/Control}");
    expect(row("Telefone").className).not.toBe(normal);
    await user.keyboard("{Escape}");
    expect(row("Telefone").className).toBe(normal);

    await user.keyboard("{Control>}x{/Control}");
    await user.click(row("Pessoal"));
    await user.keyboard("{Control>}v{/Control}");
    await waitFor(() => expect(treeRows()).toContain("  Telefone"));
    expect(treeRows()).toEqual(["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "  Telefone", "Agenda"]);

    // Recortar e colar move só uma vez.
    await user.keyboard("{Control>}v{/Control}");
    expect(fake.snippets).toHaveLength(5);
  });

  it("Ctrl+C e Ctrl+V no próprio item duplicam com “ - Cópia” e o texto vai para o clipboard", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Assinatura" }));
    await user.keyboard("{Control>}c{/Control}");
    expect(await navigator.clipboard.readText()).toBe("Att.");

    await user.keyboard("{Control>}v{/Control}");
    await waitFor(() => expect(treeRows()).toContain("  Assinatura - Cópia"));
    expect(selectedRows()).toEqual(["Assinatura - Cópia"]);
    await user.keyboard("{Control>}v{/Control}");
    await waitFor(() => expect(treeRows()).toContain("  Assinatura - Cópia (2)"));

    // Em outra pasta, o nome se mantém; uma pasta é copiada com o conteúdo.
    await user.click(row("Trabalho"));
    await user.keyboard("{Control>}c{/Control}");
    await user.click(row("Pessoal"));
    await user.keyboard("{Control>}v{/Control}");
    await waitFor(() => expect(treeRows()).toContain("  Trabalho"));
    expect(treeRows().slice(treeRows().indexOf("Pessoal"))).toEqual([
      "Pessoal",
      "  Trabalho",
      "    Assinatura",
      "    Resposta",
      "    Assinatura - Cópia",
      "    Assinatura - Cópia (2)",
      "  Endereço",
      "Telefone",
      "Agenda",
    ]);

    focusTree();
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(treeRows()).not.toContain("  Trabalho"));
  });

  it("nos campos de texto, Ctrl+C, Ctrl+V e Ctrl+Z ficam com o campo", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(treeRows()).not.toContain("Telefone"));
    await user.click(row("Agenda"));
    const content = screen.getByRole("textbox", { name: "Conteúdo" });
    await user.click(content);
    await user.keyboard("{Control>}c{/Control}{Control>}z{/Control}");

    expect(treeRows()).not.toContain("Telefone");
    expect(await fake.api.listTrash()).toHaveLength(1);
  });
});

describe("lixeira", () => {
  it("Desfazer na notificação devolve o item ao mesmo lugar", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Assinatura" }));
    await user.keyboard("{Delete}");
    const toast = (await screen.findByText("1 item movido para a lixeira.")).closest<HTMLElement>("[role=listitem]")!;
    await waitFor(() => expect(treeRows()).not.toContain("  Assinatura"));
    expect(screen.getByRole("button", { name: "Lixeira, 1 item" })).toBeInTheDocument();

    await user.click(within(toast).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(treeRows()).toEqual(SEEDED));
    expect(screen.getByRole("button", { name: "Lixeira, 0 itens" })).toBeInTheDocument();
  });

  it("restaura, exclui definitivamente e esvazia pela Lixeira", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{Control>}");
    await user.click(row("Agenda"));
    await user.click(row("Pessoal"));
    await user.keyboard("{/Control}");
    await user.keyboard("{Delete}");
    await waitFor(() => expect(treeRows()).toEqual(["Trabalho", "  Assinatura", "  Resposta"]));

    await user.click(screen.getByRole("button", { name: "Lixeira, 3 itens" }));
    const panel = within(screen.getByRole("region", { name: "Lixeira" }));
    const items = within(panel.getByRole("listbox", { name: "Itens na lixeira" }));
    expect(items.getAllByRole("option").map((option) => option.getAttribute("aria-label"))).toEqual([
      "Pessoal",
      "Telefone",
      "Agenda",
    ]);
    expect(items.getByText("Pasta com 1 texto")).toBeInTheDocument();

    // Os botões de cada item aparecem no item selecionado (ou sob o mouse).
    await user.click(items.getByRole("option", { name: "Telefone" }));
    await user.click(items.getByRole("button", { name: "Restaurar “Telefone”" }));
    await waitFor(() => expect(treeRows()).toContain("Telefone"));

    await user.click(items.getByRole("option", { name: "Agenda" }));
    await user.click(panel.getByRole("button", { name: "Excluir definitivamente" }));
    let dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Excluir definitivamente “Agenda”?")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(fake.snippets.map((s) => s.title)).not.toContain("Agenda"));

    await user.click(panel.getByRole("button", { name: "Esvaziar lixeira" }));
    dialog = within(await screen.findByRole("alertdialog"));
    expect(
      dialog.getByText(
        "O item da lixeira será excluído definitivamente, incluindo 1 pasta com 1 texto. Esta ação não pode ser desfeita.",
      ),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Esvaziar lixeira" }));

    await waitFor(() => expect(panel.getByText("A lixeira está vazia.")).toBeInTheDocument());
    expect(fake.folders.map((f) => f.name)).toEqual(["Trabalho"]);
  });

  it("informa quando a exclusão não pode mais ser desfeita", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(treeRows()).not.toContain("Telefone"));
    await fake.api.emptyTrash();

    focusTree();
    await user.keyboard("{Control>}z{/Control}");

    expect(await screen.findByText("Não foi possível desfazer.")).toBeInTheDocument();
  });
});

/** Transferência de arrasto compartilhada entre os eventos, como no navegador. */
function dragData() {
  const data = new Map<string, string>();
  return {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

type DragType = "dragStart" | "dragOver" | "drop" | "dragEnd";

function drag(type: DragType, element: Element, transfer: object, init: { clientY?: number; ctrlKey?: boolean } = {}) {
  const event = createEvent[type](element, { dataTransfer: transfer });
  for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { value });
  fireEvent(element, event);
}

/** Linha com 32 px de altura a partir de `top`, para calcular a posição do ponteiro. */
function place(element: Element, top: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, top, 200, 32));
}

describe("arrastar e soltar", () => {
  it("move para dentro de uma pasta e, com Ctrl, copia", async () => {
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    let transfer = dragData();
    drag("dragStart", row("Telefone"), transfer);
    drag("dragOver", row("Pessoal"), transfer);
    expect(row("Pessoal").className).not.toBe(row("Trabalho").className);
    drag("drop", row("Pessoal"), transfer);
    await waitFor(() => expect(treeRows()).toContain("  Telefone"));

    transfer = dragData();
    drag("dragStart", row("Agenda"), transfer);
    drag("dragOver", row("Trabalho"), transfer, { ctrlKey: true });
    drag("drop", row("Trabalho"), transfer, { ctrlKey: true });
    await waitFor(() => expect(treeRows()).toContain("  Agenda"));
    expect(treeRows()).toContain("Agenda");
  });

  it("reordena pela linha de inserção, só entre itens do mesmo tipo", async () => {
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Agenda" });

    const transfer = dragData();
    drag("dragStart", row("Agenda"), transfer);
    place(row("Telefone"), 100);
    drag("dragOver", row("Telefone"), transfer, { clientY: 104 });
    drag("drop", row("Telefone"), transfer, { clientY: 104 });

    await waitFor(() => expect(treeRows().slice(-2)).toEqual(["Agenda", "Telefone"]));
    // Uma pasta não aceita texto ao lado dela: a borda da pasta vale como "dentro".
    const folderTransfer = dragData();
    drag("dragStart", row("Telefone"), folderTransfer);
    place(row("Pessoal"), 200);
    drag("drop", row("Pessoal"), folderTransfer, { clientY: 202 });
    await waitFor(() => expect(treeRows()).toContain("  Telefone"));
  });

  it("não aceita uma pasta dentro dela mesma e solta na Lixeira", async () => {
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Trabalho" });

    const transfer = dragData();
    drag("dragStart", row("Trabalho"), transfer);
    drag("drop", row("Trabalho"), transfer);
    expect(treeRows()).toEqual(SEEDED);

    drag("drop", screen.getByRole("button", { name: "Lixeira, 0 itens" }), transfer);
    await waitFor(() => expect(treeRows()).toEqual(["Pessoal", "  Endereço", "Telefone", "Agenda"]));
  });

  it("fica desligado durante a busca", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });
    expect(row("Telefone")).toHaveAttribute("draggable", "true");

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "tel");

    await waitFor(() => expect(treeRows()).toEqual(["Telefone"]));
    expect(row("Telefone")).toHaveAttribute("draggable", "false");
  });
});

describe("ordenar e navegar", () => {
  it("ordena uma pasta por nome e por mais usados, e Ctrl+Z desfaz", async () => {
    const user = userEvent.setup();
    const { work } = await seed();
    const zeta = await fake.api.createSnippet(work.id, "Zeta", "z");
    await fake.api.chooseSnippet(zeta.id);
    renderApp();
    await tree().findByRole("treeitem", { name: "Zeta" });

    let menu = await openContextMenu("Trabalho");
    await user.click(menu.getByRole("menuitem", { name: "Ordenar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Por mais usados" }));
    await waitFor(() => expect(treeRows().slice(0, 4)).toEqual(["Trabalho", "  Zeta", "  Assinatura", "  Resposta"]));

    focusTree();
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(treeRows().slice(0, 4)).toEqual(["Trabalho", "  Assinatura", "  Resposta", "  Zeta"]));

    await chooseMoreOption(user, "Ordenar a raiz", "Por nome (A–Z)");
    await waitFor(() =>
      expect(treeRows().filter((name) => !name.startsWith(" "))).toEqual(["Pessoal", "Trabalho", "Agenda", "Telefone"]),
    );
    menu = await openContextMenu("Pessoal");
    expect(menu.getByRole("menuitem", { name: "Ordenar" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("recolhe e expande todas as pastas", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Assinatura" });

    await chooseMoreOption(user, "Recolher tudo");
    expect(treeRows()).toEqual(["Trabalho", "Pessoal", "Telefone", "Agenda"]);
    await chooseMoreOption(user, "Expandir tudo");
    expect(treeRows()).toEqual(SEEDED);
  });

  it("digitar letras salta para o item e Shift+setas estendem a seleção", async () => {
    const user = userEvent.setup();
    await seed();
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    focusTree();
    await user.keyboard("te");
    expect(selectedRows()).toEqual(["Telefone"]);

    await user.click(row("Trabalho"));
    await user.keyboard("re");
    expect(selectedRows()).toEqual(["Resposta"]);
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(selectedRows()).toEqual(["Resposta", "Pessoal", "Endereço"]);
  });

  it("o editor mostra quantas vezes o texto foi usado", async () => {
    const user = userEvent.setup();
    const phone = await fake.api.createSnippet(null, "Telefone", "1234");
    await fake.api.createSnippet(null, "Agenda", "https://agenda");
    await fake.api.chooseSnippet(phone.id);
    await fake.api.chooseSnippet(phone.id);
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    expect(screen.getByText(/^Usado 2 vezes · último uso em \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    await user.click(row("Agenda"));
    expect(screen.getByText("Ainda não usado")).toBeInTheDocument();
  });
});
