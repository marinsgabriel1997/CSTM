import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import Picker from "./Picker";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

function renderPicker() {
  render(
    <FluentProvider theme={webLightTheme}>
      <Picker />
    </FluentProvider>,
  );
}

function search() {
  return screen.getByRole("combobox", { name: "Buscar" });
}

function list() {
  return within(screen.getByRole("listbox", { name: "Textos" }));
}

/** Linhas escolhíveis, na ordem da tela; a selecionada vem marcada com `=>`. */
function optionNames() {
  return list()
    .queryAllByRole("option")
    .map((option) => `${option.getAttribute("aria-selected") === "true" ? "=> " : ""}${option.textContent}`);
}

/** Biblioteca do protótipo: Trabalho › E-mails, Pessoal e textos na raiz. */
async function seed() {
  const work = await fake.api.createFolder(null, "Trabalho");
  const mail = await fake.api.createFolder(work.id, "E-mails");
  const personal = await fake.api.createFolder(null, "Pessoal");
  await fake.api.createSnippet(mail.id, "Resposta padrão", "Obrigado pelo contato.");
  await fake.api.createSnippet(mail.id, "Follow-up", "Teve a chance de ver a proposta?");
  const formal = await fake.api.createSnippet(work.id, "Saudação formal", "Prezado(a),");
  await fake.api.createSnippet(personal.id, "Respostas rápidas", "Pode deixar.");
  const phone = await fake.api.createSnippet(null, "Telefone", "(11) 91234-5678");
  await fake.api.createSnippet(null, "Link da agenda", "https://agenda.exemplo.com");
  await fake.api.setFavorite(formal.id, true);
  await fake.api.setFavorite(phone.id, true);
}

describe("raiz", () => {
  it("mostra favoritos e o conteúdo da raiz, com a busca focada e a primeira linha selecionada", async () => {
    await seed();
    renderPicker();

    await list().findByRole("option", { name: "Trabalho" });
    expect(search()).toHaveFocus();
    expect(list().getByText("Favoritos")).toBeInTheDocument();
    expect(list().getByText("Todos")).toBeInTheDocument();
    expect(optionNames()).toEqual([
      "=> Saudação formal",
      "Telefone",
      "Trabalho",
      "Pessoal",
      "Telefone",
      "Link da agenda",
    ]);
  });

  it("omite a seção de favoritos quando não há favoritos", async () => {
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderPicker();

    await list().findByRole("option", { name: "Telefone" });
    expect(list().queryByText("Favoritos")).not.toBeInTheDocument();
  });

  it("convida a abrir o cadastro quando a biblioteca está vazia", async () => {
    const user = userEvent.setup();
    const hidePicker = vi.spyOn(api, "hidePicker");
    const showWindow = vi.spyOn(api, "showWindow");
    renderPicker();

    await user.click(await screen.findByRole("button", { name: "Abrir cadastro" }));

    expect(screen.getByText("Nenhum texto cadastrado.")).toBeInTheDocument();
    expect(hidePicker).toHaveBeenCalled();
    expect(showWindow).toHaveBeenCalled();
  });
});

describe("navegação", () => {
  it("abre e volta de pastas pelo teclado, selecionando a pasta de onde saiu", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: "Trabalho" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["=> E-mails", "Saudação formal"]);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Trabalho › E-mails" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["=> Resposta padrão", "Follow-up"]);

    await user.keyboard("{Backspace}");
    expect(optionNames()).toEqual(["=> E-mails", "Saudação formal"]);

    await user.keyboard("{ArrowLeft}");
    expect(optionNames()).toContain("=> Trabalho");
  });

  it("volta pela linha com o caminho e informa a pasta vazia", async () => {
    const user = userEvent.setup();
    await fake.api.createFolder(null, "Vazia");
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderPicker();

    await user.click(await list().findByRole("option", { name: "Vazia" }));
    expect(screen.getByText("Pasta vazia.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vazia" }));
    expect(optionNames()).toEqual(["=> Vazia", "Telefone"]);
  });

  it("move a seleção com as setas, Home e End, sem passar do fim", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{End}");
    expect(optionNames()[5]).toBe("=> Link da agenda");
    await user.keyboard("{ArrowDown}");
    expect(optionNames()[5]).toBe("=> Link da agenda");
    await user.keyboard("{Home}{ArrowUp}");
    expect(optionNames()[0]).toBe("=> Saudação formal");
  });
});

describe("escolha", () => {
  it("Enter entrega o texto selecionado", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{ArrowDown}{Enter}");

    expect(fake.delivered).toEqual(["(11) 91234-5678"]);
  });

  it("o clique entrega o texto e passar o mouse move a seleção", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    const link = await list().findByRole("option", { name: "Link da agenda" });

    await user.hover(link);
    expect(link).toHaveAttribute("aria-selected", "true");
    await user.click(link);

    expect(fake.delivered).toEqual(["https://agenda.exemplo.com"]);
    expect(search()).toHaveFocus();
  });

  it("mostra o erro quando o texto não pode ser entregue", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    api.chooseSnippet = vi.fn().mockRejectedValue("não foi possível copiar o texto");
    renderPicker();
    await list().findByRole("option", { name: "Telefone" });

    await user.keyboard("{Enter}");

    expect(await screen.findByText("não foi possível copiar o texto")).toBeInTheDocument();
  });

  it("Esc fecha o menu sem entregar nada", async () => {
    const user = userEvent.setup();
    const hidePicker = vi.spyOn(api, "hidePicker");
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{Escape}");

    expect(hidePicker).toHaveBeenCalled();
    expect(fake.delivered).toEqual([]);
  });
});

describe("busca", () => {
  it("lista os resultados de toda a biblioteca com a pasta de cada um", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("resp");

    await waitFor(() => expect(optionNames()).toEqual(["=> Resposta padrãoE-mails", "Respostas rápidasPessoal"]));
    expect(list().getByRole("option", { name: /Resposta padrão/ })).toHaveAttribute(
      "title",
      "Trabalho › E-mails\n\nObrigado pelo contato.",
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(fake.delivered).toEqual(["Pode deixar."]);
  });

  it("informa quando nada é encontrado e não navega pastas com texto na busca", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("orçamento");
    expect(await screen.findByText("Nenhum texto encontrado.")).toBeInTheDocument();

    await user.keyboard("{Backspace}{ArrowLeft}");
    expect(search()).toHaveValue("orçament");
  });
});

describe("abertura", () => {
  it("cada abertura volta à raiz, limpa a busca e recarrega os dados", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await user.click(await list().findByRole("option", { name: "Pessoal" }));
    await user.keyboard("pode");

    await fake.api.createSnippet(null, "Endereço", "Rua A, 1");
    act(() => fake.openPicker());

    expect(await list().findByRole("option", { name: "Endereço" })).toBeInTheDocument();
    expect(search()).toHaveValue("");
    expect(list().getByText("Favoritos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pessoal" })).not.toBeInTheDocument();
  });
});
