import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "./api";
import App from "./App";
import { shortcutLabel } from "./shortcut";
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

function pageButton(name: string) {
  return screen.getByRole("button", { name });
}

async function openContextMenu(name: string) {
  fireEvent.contextMenu(tree().getByRole("treeitem", { name }));
  return within(await screen.findByRole("menu"));
}

const PAGES = [
  { button: "Configurações", region: "Configurações" },
  { button: "Ajuda", region: "Ajuda" },
  { button: "Sobre o CSTM", region: "Sobre o CSTM" },
];

describe("páginas na área do editor", () => {
  it.each(PAGES)("o botão $button abre a página no lugar do editor, marca o botão e alterna de volta", async (page) => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    expect(screen.getByRole("textbox", { name: "Título" })).toBeInTheDocument();
    // A engrenagem só aparece com o atalho carregado.
    await screen.findByRole("button", { name: "Configurações" });

    await user.click(pageButton(page.button));

    expect(screen.getByRole("region", { name: page.region })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Título" })).not.toBeInTheDocument();
    expect(pageButton(page.button)).toHaveAttribute("aria-pressed", "true");
    for (const other of PAGES.filter((candidate) => candidate !== page)) {
      expect(pageButton(other.button)).toHaveAttribute("aria-pressed", "false");
    }

    await user.click(pageButton(page.button));

    expect(screen.queryByRole("region", { name: page.region })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Telefone");
    expect(pageButton(page.button)).toHaveAttribute("aria-pressed", "false");
  });

  it("selecionar um item da árvore volta ao editor", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await tree().findByRole("treeitem", { name: "Telefone" });

    await user.click(pageButton("Ajuda"));
    await user.click(tree().getByRole("treeitem", { name: "Telefone" }));

    expect(screen.queryByRole("region", { name: "Ajuda" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Telefone");
  });

  it("criar um texto com Ctrl+N volta ao editor", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await user.click(pageButton("Sobre o CSTM"));
    await user.keyboard("{Control>}n{/Control}");

    expect(screen.queryByRole("region", { name: "Sobre o CSTM" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Título" })).toBeInTheDocument();
  });

  it("criar uma pasta com Ctrl+Shift+N volta ao editor", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await user.click(pageButton("Ajuda"));
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");

    expect(screen.queryByRole("region", { name: "Ajuda" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome da nova pasta" })).toBeInTheDocument();
  });

  it("a bandeja sempre abre a página, sem alternar", async () => {
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    act(() => fake.requestPage("help"));
    expect(await screen.findByRole("region", { name: "Ajuda" })).toBeInTheDocument();
    act(() => fake.requestPage("help"));
    expect(screen.getByRole("region", { name: "Ajuda" })).toBeInTheDocument();

    act(() => fake.requestPage("about"));
    expect(await screen.findByRole("region", { name: "Sobre o CSTM" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Ajuda" })).not.toBeInTheDocument();
  });
});

describe("Ajuda", () => {
  it("F1 abre a Ajuda, que começa na aba Básico, e as abas trocam o conteúdo", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");

    await user.keyboard("{F1}");

    const help = within(await screen.findByRole("region", { name: "Ajuda" }));
    expect(help.getByRole("tab", { name: "Básico" })).toHaveAttribute("aria-selected", "true");
    expect(help.getByText("Crie um texto")).toBeInTheDocument();
    expect(help.queryByRole("heading", { name: "Busca" })).not.toBeInTheDocument();

    await user.click(help.getByRole("tab", { name: "Avançado" }));

    expect(help.getByRole("heading", { name: "Busca" })).toBeInTheDocument();
    expect(help.queryByText("Crie um texto")).not.toBeInTheDocument();

    await user.click(help.getByRole("tab", { name: "Básico" }));
    expect(help.getByText("Crie um texto")).toBeInTheDocument();
  });

  it("cita o atalho configurado e converte a marcação em negrito e tecla", async () => {
    fake.shortcut.shortcut = "Ctrl+Shift+Space";
    const user = userEvent.setup();
    renderApp();
    // O atalho chega depois da primeira renderização.
    await user.click(await screen.findByRole("button", { name: "Configurações" }));
    await user.click(pageButton("Ajuda"));

    const help = within(screen.getByRole("region", { name: "Ajuda" }));
    expect(help.getByText(shortcutLabel("Ctrl+Shift+Space"), { selector: "kbd" })).toBeInTheDocument();
    expect(help.queryByText(/\{atalho\}/)).not.toBeInTheDocument();
    expect(help.getAllByText("Novo", { selector: "strong" }).length).toBeGreaterThan(0);
    expect(help.getByText("Ctrl+N", { selector: "kbd" })).toBeInTheDocument();
  });

  it("abre sozinha só na primeira execução", async () => {
    fake.about.helpPending = true;
    renderApp();

    const help = within(await screen.findByRole("region", { name: "Ajuda" }));
    expect(help.getByRole("tab", { name: "Básico" })).toHaveAttribute("aria-selected", "true");

    cleanup();
    renderApp();
    await screen.findByText("Nenhum texto ainda");
    expect(screen.queryByRole("region", { name: "Ajuda" })).not.toBeInTheDocument();
  });

  it("Ctrl+X dentro da página não recorta itens da árvore", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));
    await user.keyboard("{F1}");
    await user.click(await screen.findByRole("tab", { name: "Avançado" }));

    await user.keyboard("{Control>}x{/Control}");
    await user.click(pageButton("Ajuda"));
    const menu = await openContextMenu("Telefone");

    // Sem item recortado, o Colar do menu fica desabilitado.
    expect(menu.getByRole("menuitem", { name: /^Colar/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("Ctrl+X fora da página recorta o item (controle do teste anterior)", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    await user.click(await tree().findByRole("treeitem", { name: "Telefone" }));

    await user.keyboard("{Control>}x{/Control}");
    const menu = await openContextMenu("Telefone");

    expect(menu.getByRole("menuitem", { name: /^Colar/ })).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("Sobre", () => {
  async function openAbout(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText("Nenhum texto ainda");
    await user.click(pageButton("Sobre o CSTM"));
    return within(screen.getByRole("region", { name: "Sobre o CSTM" }));
  }

  it("mostra a versão e o caminho da pasta dos dados", async () => {
    const user = userEvent.setup();
    renderApp();

    const about = await openAbout(user);

    expect(await about.findByText(/versão 0\.14\.0/)).toBeInTheDocument();
    expect(await about.findByText(fake.about.dataDir)).toBeInTheDocument();
    expect(about.getByText("Licença MIT · © 2026 Gabriel de Marins")).toBeInTheDocument();
  });

  it("o link e Abrir pasta pedem a abertura ao backend", async () => {
    const user = userEvent.setup();
    renderApp();
    const about = await openAbout(user);

    await user.click(about.getByRole("button", { name: "github.com/marinsgabriel1997/CSTM" }));
    await user.click(about.getByRole("button", { name: "Abrir pasta" }));

    expect(fake.about.opened).toEqual(["repository", "dataFolder"]);
  });

  it("mostra o erro quando não consegue abrir o link ou a pasta", async () => {
    const user = userEvent.setup();
    fake.about.failure = "sem navegador";
    renderApp();
    const about = await openAbout(user);

    await user.click(about.getByRole("button", { name: "github.com/marinsgabriel1997/CSTM" }));
    expect(await about.findByText(/Não foi possível abrir o link: sem navegador/)).toBeInTheDocument();

    await user.click(about.getByRole("button", { name: "Abrir pasta" }));
    await waitFor(() =>
      expect(about.getByText(/Não foi possível abrir a pasta: sem navegador/)).toBeInTheDocument(),
    );
    expect(fake.about.opened).toEqual([]);
  });
});
