import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import App, { NOTICE_DURATION_MS } from "./App";
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

  it("exclui a pasta para a lixeira, com o conteúdo e sem confirmação", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Trabalho" });

    const menu = await openContextMenu("Trabalho");
    await user.click(menu.getByRole("menuitem", { name: /Excluir/ }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(treeRows()).toEqual(["Telefone"]));
    expect(await screen.findByText("1 item movido para a lixeira.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lixeira, 1 item" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("1 texto · 0 pastas");
    expect(await fake.api.listTrash()).toMatchObject([{ kind: "folder", name: "Trabalho", snippets: 1 }]);
  });
});

describe("teclado na árvore", () => {
  it("navega com as setas e Del move para a lixeira, selecionando o item seguinte", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Primeiro", "1");
    await fake.api.createSnippet(null, "Segundo", "2");
    await fake.api.createSnippet(null, "Terceiro", "3");
    renderApp();
    await tree().findByRole("treeitem", { name: "Primeiro" });

    screen.getByRole("tree", { name: "Biblioteca" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(tree().getByRole("treeitem", { name: "Segundo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Segundo");

    await user.keyboard("{Delete}");

    await waitFor(() => expect(treeRows()).toEqual(["Primeiro", "Terceiro"]));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(tree().getByRole("treeitem", { name: "Terceiro" })).toHaveAttribute("aria-selected", "true");
  });

  it("Shift+Del pede confirmação, informando o que vai junto, e Cancelar mantém tudo", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    const emails = await fake.api.createFolder(work.id, "E-mails");
    const favorite = await fake.api.createSnippet(emails.id, "Resposta", "Olá");
    await fake.api.setFavorite(favorite.id, true);
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await user.keyboard("{Shift>}{Delete}{/Shift}");
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Excluir definitivamente a pasta “Trabalho”?")).toBeInTheDocument();
    expect(dialog.getByText("1 subpasta")).toBeInTheDocument();
    expect(dialog.getByText("2 textos, incluindo 1 favorito")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));

    expect(fake.folders).toHaveLength(2);
    expect(treeRows()).toEqual(["Trabalho", "  E-mails", "    Resposta", "  Assinatura"]);
  });

  it("Shift+Del exclui definitivamente, sem passar pela lixeira", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    await fake.api.createSnippet(work.id, "Assinatura", "Att.");
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await user.keyboard("{Shift>}{Delete}{/Shift}");
    const dialog = within(await screen.findByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Excluir definitivamente" }));

    await waitFor(() => expect(fake.folders).toHaveLength(0));
    expect(fake.snippets.map((s) => s.title)).toEqual(["Telefone"]);
    expect(await fake.api.listTrash()).toEqual([]);
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

describe("atalho do menu de colagem", () => {
  it("avisa quando o atalho não pôde ser registrado e oferece alterá-lo", async () => {
    const user = userEvent.setup();
    fake.shortcut.registered = false;
    renderApp();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O atalho Alt+Q não pôde ser registrado");

    await user.click(within(alert).getByRole("button", { name: "Alterar atalho" }));
    expect(await screen.findByRole("region", { name: "Configurações" })).toBeInTheDocument();
    // Com as Configurações abertas, o aviso some.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o aviso pode ser fechado", async () => {
    const user = userEvent.setup();
    fake.shortcut.registered = false;
    renderApp();

    await user.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Fechar mensagem" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não mostra aviso com o atalho ativo", async () => {
    renderApp();

    await screen.findByText("Nenhum texto ainda");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("configurações", () => {
  async function openSettings(user: User) {
    await user.click(await screen.findByRole("button", { name: "Configurações" }));
    return within(await screen.findByRole("region", { name: "Configurações" }));
  }

  function shortcutField() {
    return screen.getByRole("textbox", { name: "Atalho" });
  }

  function shownKeys() {
    return [...shortcutField().querySelectorAll("kbd")].map((key) => key.textContent);
  }

  it("oferece a navegação nas pastas, com a cascata como padrão, e grava a escolha", async () => {
    const user = userEvent.setup();
    renderApp();
    let dialog = await openSettings(user);

    const cascade = await dialog.findByRole("radio", { name: /Abrir ao passar o mouse/ });
    const click = dialog.getByRole("radio", { name: "Clicar para abrir" });
    expect(dialog.getByRole("radiogroup", { name: "Navegação nas pastas" })).toBeInTheDocument();
    await waitFor(() => expect(cascade).toBeChecked());
    expect(click).not.toBeChecked();

    await user.click(click);

    expect(click).toBeChecked();
    expect(await fake.api.getPickerNavigation()).toBe("click");
    // A escolha persiste: a página de uma nova sessão a mostra.
    cleanup();
    renderApp();
    dialog = await openSettings(user);
    await waitFor(() => expect(dialog.getByRole("radio", { name: "Clicar para abrir" })).toBeChecked());

    await user.click(dialog.getByRole("radio", { name: /Abrir ao passar o mouse/ }));
    expect(await fake.api.getPickerNavigation()).toBe("cascade");
  });

  it("oferece o modo de colagem padrão, com markdown como padrão, e grava a escolha", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);

    const markdown = await dialog.findByRole("radio", { name: /Markdown/ });
    expect(dialog.getByRole("radiogroup", { name: "Modo de colagem padrão" })).toBeInTheDocument();
    await waitFor(() => expect(markdown).toBeChecked());

    await user.click(dialog.getByRole("radio", { name: "Google Chat" }));

    expect(dialog.getByRole("radio", { name: "Google Chat" })).toBeChecked();
    expect(await fake.api.getPasteFormat()).toBe("chat");
  });

  it("oferece Depois de colar, mantendo o que foi colado como padrão, e grava a escolha", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);

    const keep = await dialog.findByRole("radio", { name: /Manter o que foi colado/ });
    expect(dialog.getByRole("radiogroup", { name: "Depois de colar" })).toBeInTheDocument();
    await waitFor(() => expect(keep).toBeChecked());

    await user.click(dialog.getByRole("radio", { name: /Restaurar o conteúdo anterior/ }));

    expect(dialog.getByRole("radio", { name: /Restaurar o conteúdo anterior/ })).toBeChecked();
    expect(await fake.api.getAfterPaste()).toBe("restore");
  });

  it("mostra o erro quando não consegue salvar Depois de colar", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    const restore = await dialog.findByRole("radio", { name: /Restaurar o conteúdo anterior/ });
    await waitFor(() => expect(restore).toBeEnabled());
    vi.spyOn(api, "setAfterPaste").mockRejectedValueOnce("falhou");

    await user.click(restore);

    expect(await dialog.findByText(/Não foi possível salvar a opção Depois de colar/)).toBeInTheDocument();
    expect(await fake.api.getAfterPaste()).toBe("keep");
  });

  it("oferece o tema, seguindo o Windows como padrão, e grava a escolha", async () => {
    const user = userEvent.setup();
    renderApp();
    let dialog = await openSettings(user);

    expect(dialog.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    await waitFor(() => expect(dialog.getByRole("radio", { name: "Seguir o Windows" })).toBeChecked());

    await user.click(dialog.getByRole("radio", { name: "Escuro" }));

    expect(dialog.getByRole("radio", { name: "Escuro" })).toBeChecked();
    expect(await fake.api.getTheme()).toBe("dark");
    cleanup();
    renderApp();
    dialog = await openSettings(user);
    await waitFor(() => expect(dialog.getByRole("radio", { name: "Escuro" })).toBeChecked());
  });

  it("liga e desliga a inicialização com o Windows", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    const toggle = dialog.getByRole("switch", { name: "Iniciar com o Windows" });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(fake.autostart.enabled).toBe(true);

    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(fake.autostart.enabled).toBe(false);
  });

  it("mostra a inicialização com o Windows conforme o sistema e o erro ao alterar", async () => {
    const user = userEvent.setup();
    fake.autostart.enabled = true;
    fake.autostart.failure = "Acesso negado.";
    renderApp();
    const dialog = await openSettings(user);
    const toggle = dialog.getByRole("switch", { name: "Iniciar com o Windows" });
    await waitFor(() => expect(toggle).toBeChecked());

    await user.click(toggle);

    expect(
      await dialog.findByText("Não foi possível alterar a inicialização com o Windows: Acesso negado."),
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it("liga e desliga o histórico do clipboard, ligado por padrão", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    const toggle = dialog.getByRole("switch", { name: "Guardar o histórico do clipboard" });
    await waitFor(() => expect(toggle).toBeChecked());

    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(fake.historyState.monitoring).toBe(false);

    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(fake.historyState.monitoring).toBe(true);
  });

  it("limpa o histórico só depois da confirmação", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({ title: "um" });
    fake.copyElsewhere({ title: "dois" });
    renderApp();
    const dialog = await openSettings(user);
    const clear = dialog.getByRole("button", { name: "Limpar histórico" });
    await waitFor(() => expect(clear).toBeEnabled());

    await user.click(clear);
    expect(dialog.getByText(/Apagar os 2 itens do histórico\?/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(fake.history).toHaveLength(2);

    await user.click(dialog.getByRole("button", { name: "Limpar histórico" }));
    await user.click(dialog.getByRole("button", { name: "Limpar" }));

    expect(await dialog.findByText("Histórico limpo.")).toBeInTheDocument();
    expect(fake.history).toHaveLength(0);
    expect(dialog.getByRole("button", { name: "Limpar histórico" })).toBeDisabled();
    // Limpar não desliga a opção.
    expect(dialog.getByRole("switch", { name: "Guardar o histórico do clipboard" })).toBeChecked();
  });

  it("mostra o erro ao limpar o histórico", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({ title: "um" });
    renderApp();
    const dialog = await openSettings(user);
    const clear = dialog.getByRole("button", { name: "Limpar histórico" });
    await waitFor(() => expect(clear).toBeEnabled());
    fake.historyState.failure = "banco indisponível";

    await user.click(clear);
    expect(dialog.getByText(/Apagar o item do histórico\?/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Limpar" }));

    expect(await dialog.findByText("Não foi possível limpar o histórico: banco indisponível")).toBeInTheDocument();
    expect(fake.history).toHaveLength(1);
  });

  it("restaurar o atalho padrão não altera a navegação nas pastas", async () => {
    const user = userEvent.setup();
    fake.setNavigation("click");
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));
    await user.keyboard("{Alt>}w{/Alt}");
    await dialog.findByText("Atalho alterado.");

    await user.click(dialog.getByRole("button", { name: "Restaurar padrão (Alt+Q)" }));

    await waitFor(() => expect(fake.shortcut.shortcut).toBe("Alt+KeyQ"));
    expect(await fake.api.getPickerNavigation()).toBe("click");
    expect(dialog.getByRole("radio", { name: "Clicar para abrir" })).toBeChecked();
  });

  it("mostra o atalho atual, com o padrão sem a opção de restaurar", async () => {
    const user = userEvent.setup();
    renderApp();

    const dialog = await openSettings(user);

    expect(shownKeys()).toEqual(["Alt", "Q"]);
    expect(dialog.getByRole("button", { name: "Restaurar padrão (Alt+Q)" })).toBeDisabled();
  });

  it("grava a combinação pressionada, suspendendo o atalho durante a gravação", async () => {
    const user = userEvent.setup();
    const suspend = vi.spyOn(api, "suspendShortcut");
    renderApp();
    const dialog = await openSettings(user);

    await user.click(dialog.getByRole("button", { name: "Alterar" }));
    expect(suspend).toHaveBeenCalled();
    expect(fake.shortcut.registered).toBe(false);
    expect(shortcutField()).toHaveTextContent("Pressione o novo atalho…");

    await user.keyboard("{Control>}{Shift>}");
    expect(shownKeys()).toEqual(["Ctrl", "Shift", "…"]);
    await user.keyboard("[Space]{/Shift}{/Control}");

    expect(await dialog.findByText("Atalho alterado.")).toBeInTheDocument();
    expect(fake.shortcut).toEqual({ shortcut: "Ctrl+Shift+Space", registered: true });
    expect(shownKeys()).toEqual(["Ctrl", "Shift", "Espaço"]);
    expect(dialog.getByRole("button", { name: "Restaurar padrão (Alt+Q)" })).toBeEnabled();
  });

  it("explica a regra diante de uma combinação inválida e continua aguardando", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));

    await user.keyboard("q");
    expect(dialog.getByText(/Use Ctrl ou Alt/)).toBeInTheDocument();

    await user.keyboard("{Alt>}w{/Alt}");
    expect(await dialog.findByText("Atalho alterado.")).toBeInTheDocument();
    expect(fake.shortcut.shortcut).toBe("Alt+KeyW");
  });

  it("Esc cancela a gravação, mantém a página aberta e reativa o atalho", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("region", { name: "Configurações" })).toBeInTheDocument();
    expect(shownKeys()).toEqual(["Alt", "Q"]);
    await waitFor(() => expect(fake.shortcut).toEqual({ shortcut: "Alt+KeyQ", registered: true }));
  });

  it("sair da página durante a gravação reativa o atalho", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));

    await user.click(screen.getByRole("button", { name: "Configurações" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: "Configurações" })).not.toBeInTheDocument());
    await waitFor(() => expect(fake.shortcut.registered).toBe(true));
  });

  it("informa quando o Windows recusa o atalho e mantém o anterior", async () => {
    const user = userEvent.setup();
    fake.takenShortcuts.add("Ctrl+Shift+KeyV");
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));

    await user.keyboard("{Control>}{Shift>}v{/Shift}{/Control}");

    expect(
      await dialog.findByText(/Não foi possível usar Ctrl\+Shift\+V: outro programa pode estar usando esse atalho/),
    ).toHaveTextContent("O atalho Alt+Q continua valendo.");
    await waitFor(() => expect(fake.shortcut).toEqual({ shortcut: "Alt+KeyQ", registered: true }));
  });

  it("avisa sobre o AltGr em atalhos com Ctrl+Alt e restaura o padrão", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openSettings(user);
    await user.click(dialog.getByRole("button", { name: "Alterar" }));

    await user.keyboard("{Control>}{Alt>}v{/Alt}{/Control}");
    expect(await dialog.findByText(/podem bloquear caracteres digitados com AltGr/)).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Restaurar padrão (Alt+Q)" }));
    await waitFor(() => expect(fake.shortcut.shortcut).toBe("Alt+KeyQ"));
    expect(dialog.queryByText(/AltGr/)).not.toBeInTheDocument();
  });

  it("abre pelo item Configurações da bandeja", async () => {
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    act(() => fake.requestPage("settings"));

    expect(await screen.findByRole("region", { name: "Configurações" })).toBeInTheDocument();
  });
});

describe("importação e exportação", () => {
  const summary = { folders: 0, snippets: 0, skipped: [], path: null };

  async function chooseTransfer(user: User, submenu: "Importar" | "Exportar tudo", option: string) {
    await user.click(await screen.findByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: submenu }));
    await user.click(await screen.findByRole("menuitem", { name: option }));
  }

  /** Notificação cujo título é `title`. */
  async function findToast(title: string) {
    const titleElement = await screen.findByText(title);
    const toast = titleElement.closest("[role=listitem]");
    if (!(toast instanceof HTMLElement)) throw new Error(`"${title}" não está numa notificação`);
    return toast;
  }

  /** Temporizador da notificação: o Fluent o conta por uma animação CSS, que o jsdom não executa. */
  function timer(toast: HTMLElement) {
    return toast.querySelector<HTMLElement>("[data-timer-status]");
  }

  /** Encerra a animação do temporizador. No jsdom, o React escuta o nome com prefixo. */
  function endTimer(element: HTMLElement) {
    act(() => {
      for (const name of ["animationend", "webkitAnimationEnd"]) element.dispatchEvent(new Event(name, { bubbles: true }));
    });
  }

  it("importa uma pasta no destino selecionado e lista os arquivos ignorados", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    fake.transfer.handle = async (call) => {
      const folder = await fake.api.createFolder(call.folderId ?? null, "Clientes");
      await fake.api.createSnippet(folder.id, "Contrato", "Segue o contrato.");
      return { ...summary, folders: 1, snippets: 1, skipped: [{ path: "logo.png", reason: "notTxt" }] };
    };
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Trabalho" }));
    await chooseTransfer(user, "Importar", "Pasta…");

    expect(fake.transfers).toEqual([{ command: "importFolder", folderId: work.id, includeRoot: true }]);
    const toast = await findToast("1 texto e 1 pasta importados em Trabalho.");
    expect(toast).toHaveTextContent("1 arquivo ignorado:");
    expect(within(toast).getByText("logo.png: não é um arquivo .txt")).toBeInTheDocument();
    await waitFor(() => expect(treeRows()).toEqual(["Trabalho", "  Clientes", "    Contrato"]));

    await user.click(within(toast).getByRole("button", { name: "Fechar notificação" }));
    await waitFor(() => expect(screen.queryByText("1 texto e 1 pasta importados em Trabalho.")).not.toBeInTheDocument());
  });

  it("a notificação de sucesso some após 4 segundos; a de erro fica até ser fechada", async () => {
    const user = userEvent.setup();
    fake.transfer.handle = () => ({ ...summary, snippets: 1 });
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseTransfer(user, "Importar", "Arquivos .txt…");
    const success = await findToast("1 texto importado na raiz.");
    expect(timer(success)?.style.animationDuration).toBe(`${NOTICE_DURATION_MS}ms`);
    endTimer(timer(success)!);
    await waitFor(() => expect(screen.queryByText("1 texto importado na raiz.")).not.toBeInTheDocument());

    fake.transfer.handle = () => {
      throw "o arquivo não é um backup do CSTM";
    };
    await chooseTransfer(user, "Importar", "Backup JSON…");
    const failure = await findToast("Não foi possível importar.");
    expect(timer(failure)).toBeNull();
  });

  it("empilha as notificações e importa o conteúdo de uma pasta, arquivos .txt e backups na raiz", async () => {
    const user = userEvent.setup();
    fake.transfer.handle = () => ({ ...summary, snippets: 2 });
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseTransfer(user, "Importar", "Conteúdo de uma pasta…");
    await chooseTransfer(user, "Importar", "Arquivos .txt…");
    await chooseTransfer(user, "Importar", "Backup JSON…");

    expect(fake.transfers).toEqual([
      { command: "importFolder", folderId: null, includeRoot: false },
      { command: "importTxtFiles", folderId: null },
      { command: "importJson", folderId: null },
    ]);
    await waitFor(() => expect(screen.getAllByText("2 textos importados na raiz.")).toHaveLength(3));
  });

  it("cancelar o seletor não mostra notificação", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseTransfer(user, "Importar", "Arquivos .txt…");

    expect(fake.transfers).toHaveLength(1);
    expect(document.querySelector(".fui-Toast")).toBeNull();
  });

  it("informa o erro da importação e que nada foi importado", async () => {
    const user = userEvent.setup();
    fake.transfer.handle = () => {
      throw "o arquivo não é um backup do CSTM";
    };
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseTransfer(user, "Importar", "Backup JSON…");

    const toast = await findToast("Não foi possível importar.");
    expect(toast).toHaveTextContent("O arquivo não é um backup do CSTM. Nada foi importado.");
  });

  it("grava as alterações pendentes antes de exportar tudo", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Assinatura", "Att.");
    let exported = "";
    fake.transfer.handle = () => {
      exported = fake.snippets[0].content;
      return { ...summary, snippets: 1, path: "C:\\Users\\gabriel\\CSTM.json" };
    };
    renderApp();

    await user.click(await tree().findByRole("treeitem", { name: "Assinatura" }));
    await user.type(screen.getByRole("textbox", { name: "Conteúdo" }), ",");
    await chooseTransfer(user, "Exportar tudo", "Backup JSON…");

    expect(fake.transfers).toEqual([{ command: "exportJson", items: [] }]);
    expect(exported).toBe("Att.,");
    expect(await findToast("1 texto exportado.")).toHaveTextContent("C:\\Users\\gabriel\\CSTM.json");
  });

  it("exporta uma pasta pelo menu de contexto", async () => {
    const user = userEvent.setup();
    const work = await fake.api.createFolder(null, "Trabalho");
    fake.transfer.handle = () => ({ ...summary, folders: 2, snippets: 3, path: "D:\\Trabalho" });
    renderApp();
    await tree().findByRole("treeitem", { name: "Trabalho" });

    const menu = await openContextMenu("Trabalho");
    await user.click(menu.getByRole("menuitem", { name: "Exportar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pastas e arquivos .txt…" }));

    expect(fake.transfers).toEqual([{ command: "exportTxt", items: [{ kind: "folder", id: work.id }] }]);
    expect(await findToast("3 textos e 2 pastas exportados.")).toHaveTextContent("D:\\Trabalho");
  });

  it("informa o erro da exportação", async () => {
    const user = userEvent.setup();
    fake.transfer.handle = () => {
      throw "não foi possível acessar D:\\: acesso negado";
    };
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await chooseTransfer(user, "Exportar tudo", "Pastas e arquivos .txt…");

    expect(await findToast("Não foi possível exportar.")).toHaveTextContent(
      "Não foi possível acessar D:\\: acesso negado.",
    );
  });
});
