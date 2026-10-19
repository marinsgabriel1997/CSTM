import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api } from "./api";
import App from "./App";
import { loadPreferences } from "./preferences";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  localStorage.clear();
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

afterEach(cleanup);

function renderApp() {
  render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>,
  );
}

async function helpRow() {
  return screen.findByRole("button", { name: "Ajuda" });
}

function storedSeen() {
  return JSON.parse(localStorage.getItem("cstm.preferences") ?? "{}").helpButtonSeen;
}

describe("linhas das páginas no painel", () => {
  it("ficam no painel, fora da barra inferior e da árvore", async () => {
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderApp();
    const pane = screen.getByRole("complementary", { name: "Textos e pastas" });
    for (const name of ["Ajuda", "Configurações", "Sobre o CSTM"]) {
      expect(await within(pane).findByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("contentinfo")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByRole("tree", { name: "Biblioteca" })).queryByText("Ajuda")).not.toBeInTheDocument();
    expect(await helpRow()).toHaveAttribute("title", "Ajuda (F1)");
  });

  it("destaca a Ajuda por padrão e o destaque some ao clicar nela, sem voltar ao fechar nem ao recarregar", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await helpRow()).toHaveAttribute("data-highlight", "true");

    await user.click(await helpRow());
    expect(await helpRow()).not.toHaveAttribute("data-highlight");
    expect(storedSeen()).toBe(true);

    await user.click(await helpRow());
    expect(await helpRow()).not.toHaveAttribute("data-highlight");

    cleanup();
    renderApp();
    expect(await helpRow()).not.toHaveAttribute("data-highlight");
  });

  it("F1 apaga o destaque", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await helpRow()).toHaveAttribute("data-highlight", "true");
    await user.keyboard("{F1}");
    expect(await helpRow()).not.toHaveAttribute("data-highlight");
    expect(storedSeen()).toBe(true);
  });

  it("o item Ajuda da bandeja apaga o destaque; os demais itens não", async () => {
    renderApp();
    expect(await helpRow()).toHaveAttribute("data-highlight", "true");
    act(() => fake.requestPage("about"));
    await screen.findByRole("region", { name: "Sobre o CSTM" });
    expect(await helpRow()).toHaveAttribute("data-highlight", "true");
    expect(storedSeen()).toBe(false);
    act(() => fake.requestPage("help"));
    await screen.findByRole("region", { name: "Ajuda" });
    expect(await helpRow()).not.toHaveAttribute("data-highlight");
    expect(storedSeen()).toBe(true);
  });

  it("a abertura automática da primeira execução mantém o destaque", async () => {
    fake.about.helpPending = true;
    renderApp();
    await screen.findByRole("region", { name: "Ajuda" });
    expect(await helpRow()).toHaveAttribute("data-highlight", "true");
    expect(helpRowPressed()).toBe("true");
    expect(storedSeen()).toBe(false);
  });
});

function helpRowPressed() {
  return screen.getByRole("button", { name: "Ajuda" }).getAttribute("aria-pressed");
}

describe("preferência helpButtonSeen", () => {
  it("vale false sem valor ou com valor inválido e respeita um booleano gravado", () => {
    expect(loadPreferences().helpButtonSeen).toBe(false);
    localStorage.setItem("cstm.preferences", JSON.stringify({ helpButtonSeen: "sim" }));
    expect(loadPreferences().helpButtonSeen).toBe(false);
    localStorage.setItem("cstm.preferences", JSON.stringify({ helpButtonSeen: true }));
    expect(loadPreferences().helpButtonSeen).toBe(true);
  });

  it("montar com o valor gravado não destaca a Ajuda", async () => {
    localStorage.setItem("cstm.preferences", JSON.stringify({ helpButtonSeen: true }));
    renderApp();
    expect(await helpRow()).not.toHaveAttribute("data-highlight");
  });
});
