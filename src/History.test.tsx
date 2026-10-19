// Pasta Histórico no cadastro (p86): lista, editor, exclusão, lixeira e isolamento das operações da árvore.
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import App from "./App";
import { waitForDialogSettled } from "./test/dialogs";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  localStorage.clear();
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

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

function treeRows() {
  const rows = tree().getAllByRole("treeitem");
  const root = rows.findIndex((item) => item.getAttribute("aria-label") === "Raiz" && item.getAttribute("aria-level") === "1");
  // A pasta Raiz e o nível que ela acrescenta ficam de fora: as linhas mostram a árvore da biblioteca.
  return rows
    .filter((_, position) => position !== root)
    .map((item) => {
      const level = Number(item.getAttribute("aria-level")) - (rows.indexOf(item) > root ? 1 : 0);
      return `${"  ".repeat(level - 1)}${item.getAttribute("aria-label")}`;
    });
}

function selectedRows() {
  return tree()
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.getAttribute("aria-label"));
}

function status() {
  return screen.getByRole("status", { name: "Estado do salvamento" });
}

/** Texto do histórico, do mais antigo (copiado primeiro) ao mais recente. */
function copyAll(...titles: string[]) {
  return titles.map((title) => fake.copyElsewhere({ title }));
}

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  const folder = await tree().findByRole("treeitem", { name: "Histórico" });
  // O primeiro elemento da linha é a seta que abre e fecha.
  await user.click(folder.firstElementChild!);
}

describe("pasta Histórico", () => {
  it("aparece no topo, começa fechada e mostra os itens com a hora", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Antigo", "Recente");
    renderApp();

    expect(await tree().findByRole("treeitem", { name: "Histórico" })).toBeInTheDocument();
    expect(treeRows()).toEqual(["Histórico", "Telefone"]);

    await openHistory(user);
    expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo", "Telefone"]);
    expect(within(row("Recente")).getByText("01/01")).toBeInTheDocument();
  });

  it("mostra a miniatura e o título das imagens", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({
      kind: "image",
      title: "Imagem 640 × 480",
      width: 640,
      height: 480,
      thumbnail: "data:image/png;base64,AAAA",
    });
    renderApp();

    await openHistory(user);

    expect(row("Imagem 640 × 480").querySelector("img")).toHaveAttribute("src", "data:image/png;base64,AAAA");
  });

  it("some vazia, com o histórico desligado, com busca e com o filtro de favoritos", async () => {
    const user = userEvent.setup();
    const phone = await fake.api.createSnippet(null, "Telefone", "1234");
    await fake.api.setFavorite(phone.id, true);
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });
    expect(treeRows()).toEqual(["Telefone"]);

    fake.copyElsewhere({ title: "Reunião às 15h" });
    expect(await tree().findByRole("treeitem", { name: "Histórico" })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "tel");
    await waitFor(() => expect(treeRows()).toEqual(["Telefone"]));
    await user.clear(screen.getByRole("searchbox", { name: "Buscar" }));
    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "Telefone"]));

    await user.click(screen.getByRole("button", { name: "Favoritos" }));
    await waitFor(() => expect(tree().queryByRole("treeitem", { name: "Histórico" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "Favoritos" }));
    expect(await tree().findByRole("treeitem", { name: "Histórico" })).toBeInTheDocument();

    await api.setClipboardMonitoring(false);
    await waitFor(() => expect(treeRows()).toEqual(["Telefone"]));
  });

  it("acompanha as cópias novas com a janela aberta", async () => {
    const user = userEvent.setup();
    copyAll("Primeiro");
    renderApp();
    await openHistory(user);

    fake.copyElsewhere({ title: "Segundo" });

    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Segundo", "  Primeiro"]));
  });

  it("não tem menu de contexto nem botão de ações", async () => {
    const user = userEvent.setup();
    copyAll("Texto copiado");
    renderApp();
    await openHistory(user);

    fireEvent.contextMenu(row("Texto copiado"));

    expect(screen.queryByRole("menu")).toBeNull();
    expect(within(row("Texto copiado")).queryByRole("button")).toBeNull();
    expect(selectedRows()).toEqual(["Texto copiado"]);
  });

  it("navega pelo teclado e Enter leva o foco ao conteúdo", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Antigo", "Recente");
    renderApp();
    const treeElement = await screen.findByRole("tree", { name: "Biblioteca" });
    await tree().findByRole("treeitem", { name: "Histórico" });

    treeElement.focus();
    await user.keyboard("{Home}{ArrowRight}");
    expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo", "Telefone"]);
    await user.keyboard("{ArrowDown}");
    expect(selectedRows()).toEqual(["Recente"]);
    await user.keyboard("{End}");
    expect(selectedRows()).toEqual(["Telefone"]);
    // Entre Telefone e Antigo está a pasta Raiz.
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(selectedRows()).toEqual(["Recente"]);

    await user.keyboard("{Enter}");

    expect(await screen.findByRole("textbox", { name: "Conteúdo" })).toHaveFocus();
  });
});

describe("editor do item do histórico", () => {
  it("mostra o texto e quando foi copiado", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({ title: "Reunião às 15h" }, { text: "Reunião às 15h\nna sala 2" });
    renderApp();
    await openHistory(user);

    await user.click(row("Reunião às 15h"));

    const editor = within(await screen.findByRole("region", { name: "Item do histórico" }));
    expect(editor.getByText("Histórico")).toBeInTheDocument();
    expect(editor.getByText(/^Copiado em \d\d\/\d\d\/\d{4} às \d\d:\d\d$/)).toBeInTheDocument();
    expect(await editor.findByRole("textbox", { name: "Conteúdo" })).toHaveValue("Reunião às 15h\nna sala 2");
    expect(editor.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(editor.queryByText(/Editar remove a formatação/)).toBeNull();
  });

  it("avisa que editar remove a formatação que veio junto", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({ title: "Negrito" }, { formatted: true });
    renderApp();
    await openHistory(user);

    await user.click(row("Negrito"));

    expect(
      await screen.findByText("Editar remove a formatação que veio junto (negrito, links…); o texto continua."),
    ).toBeInTheDocument();
  });

  it("grava após uma pausa, sobe o item ao topo e segue a seleção pelo id", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    const [older] = copyAll("Antigo", "Recente");
    fake.history.find((item) => item.id === older.id)!.preview = "Antigo";
    renderApp();
    await openHistory(user);
    await user.click(row("Antigo"));
    const content = await screen.findByRole("textbox", { name: "Conteúdo" });
    await waitFor(() => expect(content).toHaveValue("Antigo"));

    await user.type(content, " editado");

    expect(status()).toHaveTextContent("Alterações pendentes");
    await waitFor(() => expect(status()).toHaveTextContent("Todas as alterações salvas"), { timeout: 3000 });
    expect(fake.history.map((item) => item.id)[0]).toBe(older.id);
    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Antigo editado", "  Recente", "Telefone"]));
    expect(selectedRows()).toEqual(["Antigo editado"]);
    expect(screen.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("Antigo editado");
  });

  it("não grava texto vazio e avisa", async () => {
    const user = userEvent.setup();
    copyAll("Conteúdo original");
    renderApp();
    await openHistory(user);
    await user.click(row("Conteúdo original"));
    const content = await screen.findByRole("textbox", { name: "Conteúdo" });
    await waitFor(() => expect(content).toHaveValue("Conteúdo original"));
    const update = vi.spyOn(api, "updateClipboardItem");

    await user.clear(content);

    expect(await screen.findByText("Um item do histórico não pode ficar vazio.")).toBeInTheDocument();
    expect(status()).toHaveTextContent("Não salvo: o conteúdo está vazio");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(update).not.toHaveBeenCalled();

    await user.type(content, "x");
    expect(screen.queryByText("Um item do histórico não pode ficar vazio.")).toBeNull();
  });

  it("grava o que estiver pendente ao trocar de item", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Rascunho");
    renderApp();
    await openHistory(user);
    await user.click(row("Rascunho"));
    const content = await screen.findByRole("textbox", { name: "Conteúdo" });
    await waitFor(() => expect(content).toHaveValue("Rascunho"));

    await user.type(content, " 2");
    await user.click(row("Telefone"));

    await waitFor(() => expect(fake.history[0].title).toBe("Rascunho 2"));
  });

  it("mostra a imagem reduzida, sem edição", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere(
      { kind: "image", title: "Imagem 640 × 480", width: 640, height: 480, thumbnail: "data:image/png;base64,AAAA" },
      { image: "data:image/png;base64,BBBB" },
    );
    renderApp();
    await openHistory(user);

    await user.click(row("Imagem 640 × 480"));

    const editor = within(await screen.findByRole("region", { name: "Item do histórico" }));
    expect(editor.getByText(/· Imagem 640 × 480$/)).toBeInTheDocument();
    expect(await editor.findByRole("img", { name: "Imagem 640 × 480" })).toHaveAttribute(
      "src",
      "data:image/png;base64,BBBB",
    );
    expect(editor.queryByRole("textbox")).toBeNull();
    expect(editor.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });
});

describe("excluir do histórico", () => {
  it("o botão Excluir move para a lixeira, avisa e Desfazer devolve", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Antigo", "Recente");
    renderApp();
    await openHistory(user);
    await user.click(row("Recente"));

    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    const toast = (await screen.findByText("Item do histórico movido para a lixeira.")).closest<HTMLElement>(
      "[role=listitem]",
    )!;
    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Antigo", "Telefone"]));
    // A seleção passa ao vizinho.
    expect(selectedRows()).toEqual(["Antigo"]);
    expect(screen.getByRole("button", { name: "Lixeira, 1 item" })).toBeInTheDocument();

    await user.click(within(toast).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo", "Telefone"]));
  });

  it("Del exclui e Ctrl+Z desfaz", async () => {
    const user = userEvent.setup();
    copyAll("Antigo", "Recente");
    renderApp();
    await openHistory(user);
    await user.click(row("Recente"));
    screen.getByRole("tree", { name: "Biblioteca" }).focus();

    await user.keyboard("{Delete}");
    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Antigo"]));
    await user.keyboard("{Control>}z{/Control}");

    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo"]));
  });

  it("o último item excluído leva a seleção ao primeiro item da árvore", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Único");
    renderApp();
    await openHistory(user);
    await user.click(row("Único"));

    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(treeRows()).toEqual(["Telefone"]));
    expect(selectedRows()).toEqual(["Telefone"]);
  });

  it("Shift+Del pede confirmação antes de excluir definitivamente", async () => {
    const user = userEvent.setup();
    copyAll("Antigo", "Recente");
    renderApp();
    await openHistory(user);
    await user.click(row("Recente"));
    screen.getByRole("tree", { name: "Biblioteca" }).focus();

    await user.keyboard("{Shift>}{Delete}{/Shift}");

    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Excluir definitivamente este item do histórico?")).toBeInTheDocument();
    expect(dialog.getByText("Não é possível desfazer.")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo"]);
    await waitForDialogSettled();

    screen.getByRole("tree", { name: "Biblioteca" }).focus();
    await user.keyboard("{Shift>}{Delete}{/Shift}");
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Excluir definitivamente" }));

    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Antigo"]));
    expect(await api.listTrash()).toEqual([]);
    expect(fake.history.map((item) => item.title)).toEqual(["Antigo"]);
  });
});

describe("Lixeira com itens do histórico", () => {
  it("mostra o item como Histórico, restaura e exclui definitivamente", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Antigo", "Recente");
    renderApp();
    await openHistory(user);
    await user.click(row("Recente"));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(treeRows()).toEqual(["Histórico", "  Antigo", "Telefone"]));
    await user.click(row("Antigo"));
    screen.getByRole("tree", { name: "Biblioteca" }).focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Lixeira, 2 itens" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Lixeira, 2 itens" }));

    const panel = within(screen.getByRole("region", { name: "Lixeira" }));
    const items = within(panel.getByRole("listbox", { name: "Itens na lixeira" }));
    expect(items.getAllByRole("option").map((option) => option.getAttribute("aria-label"))).toEqual(["Antigo", "Recente"]);
    expect(items.getAllByText("Histórico")).toHaveLength(2);
    // Os totais da barra inferior não contam itens do histórico.
    expect(screen.getByText("1 texto · 0 pastas")).toBeInTheDocument();

    // Restaurar devolve o item à posição que tinha na ordem.
    await user.click(items.getByRole("option", { name: "Recente" }));
    await user.click(items.getByRole("button", { name: "Restaurar “Recente”" }));
    await user.click(await items.findByRole("option", { name: "Antigo" }));
    await user.click(items.getByRole("button", { name: "Restaurar “Antigo”" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lixeira, 0 itens" })).toBeInTheDocument());
    expect(fake.history.map((item) => item.title)).toEqual(["Recente", "Antigo"]);
    await user.click(row("Telefone"));
    expect(treeRows()).toEqual(["Histórico", "  Recente", "  Antigo", "Telefone"]);

    // Excluir definitivamente e Esvaziar os apagam.
    await user.click(row("Recente"));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    await user.click(await screen.findByRole("button", { name: "Lixeira, 1 item" }));
    await user.click(screen.getByRole("button", { name: "Esvaziar lixeira" }));
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Esvaziar lixeira" }));
    await waitFor(() => expect(fake.history.map((item) => item.title)).toEqual(["Antigo"]));
  });
});

describe("isolamento das operações da árvore", () => {
  it("Ctrl+clique e Shift+clique num item do histórico selecionam só ele", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Antigo", "Recente");
    renderApp();
    await openHistory(user);
    await user.click(row("Recente"));

    await user.keyboard("{Control>}");
    await user.click(row("Antigo"));
    await user.keyboard("{/Control}");
    expect(selectedRows()).toEqual(["Antigo"]);

    await user.keyboard("{Shift>}");
    await user.click(row("Recente"));
    await user.keyboard("{/Shift}");
    expect(selectedRows()).toEqual(["Recente"]);

    // Também a partir de um texto cadastrado, ou para chegar a um.
    await user.keyboard("{Control>}");
    await user.click(row("Telefone"));
    await user.keyboard("{/Control}");
    expect(selectedRows()).toEqual(["Telefone"]);
    await user.keyboard("{Shift>}");
    await user.click(row("Antigo"));
    await user.keyboard("{/Shift}");
    expect(selectedRows()).toEqual(["Antigo"]);
    expect(screen.queryByRole("region", { name: "Seleção" })).toBeNull();
  });

  it("recortar, copiar e colar não fazem nada num item do histórico", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    copyAll("Texto copiado");
    renderApp();
    await openHistory(user);
    await user.click(row("Texto copiado"));
    const copyItems = vi.spyOn(api, "copyItems");
    const arrange = vi.spyOn(api, "arrangeItems");
    const trash = vi.spyOn(api, "trashItems");
    screen.getByRole("tree", { name: "Biblioteca" }).focus();

    await user.keyboard("{Control>}c{/Control}{Control>}x{/Control}{Control>}v{/Control}{F2}");
    // Marcado um texto, colar com um item do histórico selecionado continua sem efeito.
    await user.click(row("Telefone"));
    await user.keyboard("{Control>}c{/Control}");
    await user.click(row("Texto copiado"));
    await user.keyboard("{Control>}v{/Control}");

    expect(copyItems).not.toHaveBeenCalled();
    expect(arrange).not.toHaveBeenCalled();
    expect(trash).not.toHaveBeenCalled();
    expect(fake.snippets).toHaveLength(1);
    expect(treeRows()).toEqual(["Histórico", "  Texto copiado", "Telefone"]);
  });

  it("Novo texto com um item do histórico selecionado cria na raiz", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    copyAll("Texto copiado");
    renderApp();
    await openHistory(user);
    await user.click(row("Texto copiado"));

    await user.click(screen.getByRole("button", { name: "Novo" }));

    expect(await screen.findByRole("menuitem", { name: /Novo texto/ })).toBeInTheDocument();
    expect(screen.getByText("Na raiz")).toBeInTheDocument();
  });

  it("a pasta Histórico não é arrastável", async () => {
    const user = userEvent.setup();
    copyAll("Texto copiado");
    renderApp();
    await openHistory(user);

    expect(row("Histórico")).toHaveAttribute("draggable", "false");
    expect(row("Texto copiado")).toHaveAttribute("draggable", "false");
  });
});
