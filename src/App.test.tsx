import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** Nomes das linhas da árvore, na ordem da tela, com a indentação como prefixo. */
function treeRows() {
  return tree()
    .getAllByRole("treeitem")
    .map((row) => `${"  ".repeat(Number(row.getAttribute("aria-level")) - 1)}${row.getAttribute("aria-label")}`);
}

function status() {
  return screen.getByRole("status", { name: "Estado do salvamento" });
}

async function chooseNew(user: User, option: "Novo texto" | "Nova pasta") {
  await user.click(screen.getByRole("button", { name: "Novo" }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(option) }));
}

async function openContextMenu(name: string) {
  fireEvent.contextMenu(tree().getByRole("treeitem", { name }));
  return within(await screen.findByRole("menu"));
}

async function waitForSave() {
  await waitFor(() => expect(status()).toHaveTextContent("Todas as alterações salvas"), { timeout: 3000 });
}

describe("primeiro uso", () => {
  it("convida a criar o primeiro texto e apresenta o aplicativo", async () => {
    renderApp();

    expect(await screen.findByText("Nenhum texto ainda")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bem-vindo ao CSTM" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("Nenhum texto cadastrado");
    expect(status()).toHaveTextContent("0 textos · 0 pastas");
  });
});

describe("criação", () => {
  it("cria um texto pelo botão Novo e o grava automaticamente", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseNew(user, "Novo texto");
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveFocus();
    expect(status()).toHaveTextContent("Rascunho: preencha o título e o conteúdo para salvar");

    await user.keyboard("Assinatura");
    await user.type(screen.getByRole("textbox", { name: "Conteúdo" }), "Att.,");
    await waitForSave();

    expect(fake.snippets.map((s) => [s.title, s.content, s.folderId])).toEqual([["Assinatura", "Att.,", null]]);
    expect(treeRows()).toEqual(["Assinatura"]);
  });

  it("cria o texto com Ctrl+N na pasta selecionada e grava na hora com Ctrl+S", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Trabalho");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await user.keyboard("{Control>}n{/Control}");
    await user.keyboard("Resposta{Enter}Obrigado!{Control>}s{/Control}");

    await waitFor(() => expect(fake.snippets).toHaveLength(1));
    expect(fake.snippets[0]).toMatchObject({ title: "Resposta", content: "Obrigado!", folderId: folder.id });
    expect(treeRows()).toEqual(["Trabalho", "  Resposta"]);
  });

  it("cria a pasta com o nome editado na própria árvore", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    await chooseNew(user, "Nova pasta");
    const name = screen.getByRole("textbox", { name: "Nome da nova pasta" });
    await user.clear(name);
    await user.type(name, "Pessoal{Enter}");

    await tree().findByRole("treeitem", { name: "Pessoal" });
    expect(fake.folders.map((f) => [f.name, f.parentId])).toEqual([["Pessoal", null]]);
    // A pasta nova entra antes dos textos da raiz e fica selecionada.
    expect(treeRows()).toEqual(["Pessoal", "Telefone"]);
    expect(screen.getByRole("textbox", { name: "Nome da pasta" })).toHaveValue("Pessoal");
  });

  it("Esc cancela a nova pasta", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    await chooseNew(user, "Nova pasta");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Nome da nova pasta" })).not.toBeInTheDocument();
    expect(fake.folders).toHaveLength(0);
  });
});

describe("edição", () => {
  it("abre o texto selecionado com o caminho da pasta", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    const emails = await fake.api.createFolder(work.id, "E-mails");
    await fake.api.createSnippet(emails.id, "Resposta padrão", "Olá!");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Resposta padrão" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Resposta padrão");
    expect(screen.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("Olá!");
    const path = within(screen.getByRole("navigation", { name: "Caminho" }));
    expect(path.getAllByRole("button").map((b) => b.textContent)).toEqual(["Trabalho", "E-mails"]);

    await user.click(path.getByRole("button", { name: "Trabalho" }));
    expect(screen.getByRole("textbox", { name: "Nome da pasta" })).toHaveValue("Trabalho");
    expect(screen.getByText("1 texto · 1 subpasta")).toBeInTheDocument();
  });

  it("preserva o texto inválido sem gravá-lo, mesmo ao trocar de item", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Saudação", "Olá");
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Saudação" }));
    await user.clear(screen.getByRole("textbox", { name: "Título" }));

    expect(await screen.findByText(/O título é obrigatório/)).toBeInTheDocument();
    expect(status()).toHaveTextContent("Não salvo: o título está vazio. A última versão salva foi mantida.");

    await user.click(tree().getByRole("treeitem", { name: "Telefone" }));
    expect(status()).toHaveTextContent("1 texto não salvo");
    await user.click(tree().getByRole("treeitem", { name: "Sem título" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("Olá");
    expect(fake.snippets[0].title).toBe("Saudação");
  });

  it("mantém as alterações quando a gravação falha e permite tentar de novo", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Saudação", "Olá");
    const update = api.updateSnippet;
    api.updateSnippet = vi.fn().mockRejectedValue("banco de dados indisponível");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Saudação" }));
    await user.type(screen.getByRole("textbox", { name: "Conteúdo" }), "!{Control>}s{/Control}");

    expect(await screen.findByText("Não foi possível salvar.")).toBeInTheDocument();
    expect(status()).toHaveTextContent("Erro ao salvar “Saudação”: banco de dados indisponível");
    expect(screen.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("Olá!");

    api.updateSnippet = update;
    await user.click(within(screen.getByRole("region", { name: "Editor" })).getByRole("button", { name: "Tentar novamente" }));

    await waitForSave();
    expect(fake.snippets[0].content).toBe("Olá!");
    expect(screen.queryByText("Não foi possível salvar.")).not.toBeInTheDocument();
  });

  it("marca e desmarca o favorito pela estrela do editor", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.click(screen.getByRole("button", { name: "Favorito" }));

    await waitFor(() => expect(fake.snippets[0].favorite).toBe(true));
    expect(screen.getByRole("button", { name: "Favorito" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("menu de contexto", () => {
  it("renomeia a pasta na própria árvore", async () => {
    const user = userEvent.setup();
    await fake.api.createFolder(null, "Antigo");
    renderApp();
    await tree().findByRole("treeitem", { name: "Antigo" });

    const menu = await openContextMenu("Antigo");
    await user.click(menu.getByRole("menuitem", { name: /Renomear/ }));
    const input = screen.getByRole("textbox", { name: "Novo nome da pasta" });
    await user.clear(input);
    await user.type(input, "Novo{Enter}");

    expect(await tree().findByRole("treeitem", { name: "Novo" })).toBeInTheDocument();
    expect(fake.folders[0].name).toBe("Novo");
  });

  it("move o texto para outra pasta pelo diálogo", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Pessoal");
    await fake.api.createSnippet(null, "Endereço", "Rua A");
    renderApp();
    await tree().findByRole("treeitem", { name: "Endereço" });

    const menu = await openContextMenu("Endereço");
    await user.click(menu.getByRole("menuitem", { name: /Mover para…/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: "Pessoal" }));
    await user.click(dialog.getByRole("button", { name: "Mover" }));

    await waitFor(() => expect(fake.snippets[0].folderId).toBe(folder.id));
    expect(treeRows()).toEqual(["Pessoal", "  Endereço"]);
  });

  it("não oferece mover a pasta para dentro de si mesma", async () => {
    const user = userEvent.setup();
    const parent = await fake.api.createFolder(null, "Pai");
    await fake.api.createFolder(parent.id, "Filha");
    await fake.api.createFolder(null, "Outra");
    renderApp();
    await tree().findByRole("treeitem", { name: "Pai" });

    const menu = await openContextMenu("Pai");
    await user.click(menu.getByRole("menuitem", { name: /Mover para…/ }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(dialog.getAllByRole("radio").map((radio) => (radio as HTMLInputElement).labels?.[0].textContent)).toEqual([
      "Raiz",
      "Outra",
    ]);
  });

  it("reordena textos e desabilita o que não se aplica", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Primeiro", "1");
    await fake.api.createSnippet(null, "Segundo", "2");
    renderApp();
    await tree().findByRole("treeitem", { name: "Primeiro" });

    let menu = await openContextMenu("Primeiro");
    expect(menu.getByRole("menuitem", { name: /Mover para cima/ })).toHaveAttribute("aria-disabled", "true");
    await user.click(menu.getByRole("menuitem", { name: /Mover para baixo/ }));

    await waitFor(() => expect(treeRows()).toEqual(["Segundo", "Primeiro"]));

    menu = await openContextMenu("Primeiro");
    expect(menu.getByRole("menuitem", { name: /Mover para baixo/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("adiciona aos favoritos pelo menu", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    const menu = await openContextMenu("Telefone");
    await user.click(menu.getByRole("menuitem", { name: /Adicionar aos favoritos/ }));

    await waitFor(() => expect(fake.snippets[0].favorite).toBe(true));
    expect(within(tree().getByRole("treeitem", { name: "Telefone" })).getByLabelText("Favorito")).toBeInTheDocument();
  });

  it("exclui a pasta somente após confirmar, informando o que vai junto", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    const emails = await fake.api.createFolder(work.id, "E-mails");
    const favorite = await fake.api.createSnippet(emails.id, "Resposta", "Olá");
    await fake.api.setFavorite(favorite.id, true);
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    renderApp();
    await tree().findByRole("treeitem", { name: "Trabalho" });

    let menu = await openContextMenu("Trabalho");
    await user.click(menu.getByRole("menuitem", { name: /Excluir/ }));
    let dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Excluir a pasta “Trabalho”?")).toBeInTheDocument();
    expect(dialog.getByText("1 subpasta")).toBeInTheDocument();
    expect(dialog.getByText("2 textos, incluindo 1 favorito")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(fake.folders).toHaveLength(2);

    menu = await openContextMenu("Trabalho");
    await user.click(menu.getByRole("menuitem", { name: /Excluir/ }));
    dialog = within(await screen.findByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(fake.folders).toHaveLength(0));
    expect(fake.snippets).toHaveLength(0);
  });
});

describe("teclado na árvore", () => {
  it("navega com as setas e exclui com Del após confirmar", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Primeiro", "1");
    await fake.api.createSnippet(null, "Segundo", "2");
    renderApp();
    await tree().findByRole("treeitem", { name: "Primeiro" });

    screen.getByRole("tree", { name: "Biblioteca" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(tree().getByRole("treeitem", { name: "Segundo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Segundo");

    await user.keyboard("{Delete}");
    const dialog = within(await screen.findByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(fake.snippets.map((s) => s.title)).toEqual(["Primeiro"]));
  });

  it("recolhe e abre pastas com as setas, lembrando a escolha", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Trabalho");
    await fake.api.createSnippet(folder.id, "Resposta", "Olá");
    renderApp();
    await tree().findByRole("treeitem", { name: "Resposta" });

    screen.getByRole("tree", { name: "Biblioteca" }).focus();
    await user.keyboard("{ArrowDown}{ArrowLeft}");

    expect(tree().getByRole("treeitem", { name: "Trabalho" })).toHaveAttribute("aria-expanded", "false");
    expect(treeRows()).toEqual(["Trabalho"]);
    expect(JSON.parse(localStorage.getItem("cstm.preferences")!).collapsed).toEqual([folder.id]);

    await user.keyboard("{ArrowRight}");
    expect(treeRows()).toEqual(["Trabalho", "  Resposta"]);
  });
});

describe("busca e favoritos", () => {
  it("filtra a árvore mantendo as pastas dos resultados e mostra trechos do conteúdo", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    const emails = await fake.api.createFolder(work.id, "E-mails");
    await fake.api.createSnippet(emails.id, "Follow-up", "Passando para saber se recebeu a proposta.");
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    await fake.api.createSnippet(null, "Proposta comercial", "Segue a proposta.");
    renderApp();
    await tree().findByRole("treeitem", { name: "Assinatura" });

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "propos");

    await waitFor(() =>
      expect(treeRows()).toEqual(["Trabalho", "  E-mails", "    Follow-up", "Proposta comercial"]),
    );
    expect(screen.getByText("2 resultados")).toBeInTheDocument();
    const followUp = tree().getByRole("treeitem", { name: "Follow-up" });
    expect(followUp).toHaveTextContent("…saber se recebeu a proposta.");
    expect(within(followUp).getByText("propos", { selector: "mark" })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Buscar" }));
    await waitFor(() => expect(treeRows()).toHaveLength(5));
  });

  it("informa quando a busca não encontra nada", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "inexistente");

    expect(await screen.findByText("Nenhum resultado.")).toBeInTheDocument();
  });

  it("o filtro de favoritos reduz a árvore aos textos marcados", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Trabalho");
    const favorite = await fake.api.createSnippet(folder.id, "Saudação", "Olá");
    await fake.api.setFavorite(favorite.id, true);
    await fake.api.createSnippet(folder.id, "Assinatura", "Att.");
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    await user.click(screen.getByRole("button", { name: "Favoritos" }));

    expect(treeRows()).toEqual(["Trabalho", "  Saudação"]);
  });
});

describe("segundo plano", () => {
  it("fechar a janela a oculta e grava as alterações, sem confirmação", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Saudação", "Olá");
    const hideWindow = vi.spyOn(api, "hideWindow");
    const exitApp = vi.spyOn(api, "exitApp");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Saudação" }));
    await user.type(screen.getByRole("textbox", { name: "Conteúdo" }), "!");
    act(() => fake.requestClose());

    expect(hideWindow).toHaveBeenCalled();
    await waitFor(() => expect(fake.snippets[0].content).toBe("Olá!"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("sair grava as alterações e encerra o aplicativo", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Saudação", "Olá");
    const exitApp = vi.spyOn(api, "exitApp");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Saudação" }));
    await user.type(screen.getByRole("textbox", { name: "Conteúdo" }), "!");
    act(() => fake.requestQuit());

    await waitFor(() => expect(exitApp).toHaveBeenCalled());
    expect(fake.snippets[0].content).toBe("Olá!");
  });

  it("sair com texto que não pode ser gravado mostra a janela e pede confirmação", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Saudação", "Olá");
    const showWindow = vi.spyOn(api, "showWindow");
    const exitApp = vi.spyOn(api, "exitApp");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Saudação" }));
    await user.clear(screen.getByRole("textbox", { name: "Título" }));
    act(() => fake.requestQuit());

    const dialog = within(await screen.findByRole("alertdialog", { name: "Sair sem salvar?" }));
    expect(showWindow).toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("");

    act(() => fake.requestQuit());
    await user.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    expect(exitApp).toHaveBeenCalled();
    expect(fake.snippets[0].title).toBe("Saudação");
  });
});
