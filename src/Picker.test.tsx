import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import Picker from "./Picker";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  fake = createFakeApi();
  // Os testes existentes descrevem a navegação por clique, anterior à cascata.
  fake.setNavigation("click");
  Object.assign(api, fake.api);
});

function renderPicker() {
  render(
    <FluentProvider theme={webLightTheme}>
      <Picker />
    </FluentProvider>,
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let moves = 0;

/** Move o mouse para o elemento; cada movimento tem uma posição nova, como no navegador. */
function hover(user: ReturnType<typeof userEvent.setup>, element: Element) {
  moves++;
  return user.pointer({ target: element, coords: { clientX: moves, clientY: moves } });
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
  it("mostra a pasta Favoritos antes do conteúdo da raiz, com a busca focada e a primeira linha selecionada", async () => {
    await seed();
    renderPicker();

    await list().findByRole("option", { name: "Trabalho" });
    expect(search()).toHaveFocus();
    expect(optionNames()).toEqual(["=> Favoritos", "Trabalho", "Pessoal", "Telefone", "Link da agenda"]);
  });

  it("omite as pastas Mais usados e Favoritos quando estão vazias", async () => {
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderPicker();

    await list().findByRole("option", { name: "Telefone" });
    expect(optionNames()).toEqual(["=> Telefone"]);
  });

  it("Mais usados lista os textos mais colados, com a pasta de cada um, e volta à raiz", async () => {
    const user = userEvent.setup();
    await seed();
    const [reply, , , quick, phone] = fake.snippets;
    for (const snippet of [reply, reply, reply, phone, quick, phone]) await fake.api.chooseSnippet(snippet.id);
    fake.delivered.length = 0;
    renderPicker();

    await list().findByRole("option", { name: "Mais usados" });
    expect(optionNames().slice(0, 3)).toEqual(["=> Mais usados", "Favoritos", "Trabalho"]);

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Mais usados" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["=> Resposta padrãoE-mails", "Telefone", "Respostas rápidasPessoal"]);

    await user.keyboard("{ArrowLeft}");
    expect(optionNames()[0]).toBe("=> Mais usados");
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(optionNames()).toEqual(["=> Saudação formalTrabalho", "Telefone"]);
  });

  it("mostra no máximo 10 textos em Mais usados", async () => {
    const user = userEvent.setup();
    for (let n = 1; n <= 12; n++) {
      const snippet = await fake.api.createSnippet(null, `Texto ${n}`, `${n}`);
      for (let use = 0; use < n; use++) await fake.api.chooseSnippet(snippet.id);
    }
    renderPicker();

    await user.click(await list().findByRole("option", { name: "Mais usados" }));

    expect(optionNames()).toHaveLength(10);
    expect(optionNames()[0]).toBe("=> Texto 12");
    expect(optionNames()[9]).toBe("Texto 3");
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

    await user.keyboard("{ArrowDown}{Enter}");
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
    expect(optionNames()[4]).toBe("=> Link da agenda");
    await user.keyboard("{ArrowDown}");
    expect(optionNames()[4]).toBe("=> Link da agenda");
    await user.keyboard("{Home}{ArrowUp}");
    expect(optionNames()[0]).toBe("=> Favoritos");
  });
});

describe("escolha", () => {
  it("Enter entrega o texto selecionado", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{Enter}{ArrowDown}{Enter}");

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

  it("mantém título e pasta em uma linha, para não invadir as linhas vizinhas", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Sistemas de Apoio");
    await fake.api.createSnippet(folder.id, "Plataforma Bry - Erro assinatura de coleta", "Texto");
    renderPicker();
    await list().findByRole("option", { name: "Sistemas de Apoio" });

    await user.keyboard("assinatura");

    const option = await list().findByRole("option", { name: /Plataforma Bry/ });
    for (const text of ["Plataforma Bry - Erro assinatura de coleta", "Sistemas de Apoio"]) {
      expect(getComputedStyle(within(option).getByText(text)).whiteSpace).toBe("nowrap");
    }
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

describe("modo clique", () => {
  it("passar o mouse numa pasta não abre coluna nem pede layout", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await hover(user, await list().findByRole("option", { name: "Trabalho" }));
    await wait(450);

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(fake.layouts).toEqual([]);
  });

  it("a opção vale na próxima abertura, não no menu já aberto", async () => {
    const user = userEvent.setup();
    await seed();
    fake.setNavigation("cascade");
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });
    fake.setNavigation("click");
    await hover(user, list().getByRole("option", { name: "Trabalho" }));
    await screen.findByRole("listbox", { name: "Trabalho" });

    act(() => fake.openPicker());
    await waitFor(() => expect(screen.getAllByRole("listbox")).toHaveLength(1));
    await hover(user, await list().findByRole("option", { name: "Trabalho" }));
    await wait(450);

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
  });
});

describe("cascata", () => {
  beforeEach(() => fake.setNavigation("cascade"));

  const columns = () => screen.getAllByRole("listbox").map((box) => box.getAttribute("aria-label"));
  const sub = (name: string) => within(screen.getByRole("listbox", { name }));

  async function openRoot() {
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });
  }

  it("abre a coluna assim que o mouse passa sobre a pasta, pedindo o layout antes", async () => {
    const user = userEvent.setup();
    await openRoot();

    await hover(user, list().getByRole("option", { name: "Trabalho" }));

    const column = await screen.findByRole("listbox", { name: "Trabalho" });
    expect(within(column).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "E-mails",
      "Saudação formal",
    ]);
    // Duas linhas de 32 px mais a margem da lista.
    expect(fake.layouts).toEqual([[{ contentHeight: 74, anchorY: 0 }]]);
    // A posição vem do backend.
    expect(column.parentElement).toHaveStyle({ left: "342px", width: "300px", height: "74px" });
    // O foco continua na busca.
    expect(search()).toHaveFocus();
  });

  it("clicar numa pasta abre a coluna na hora, sem entrar nela", async () => {
    const user = userEvent.setup();
    await openRoot();

    await user.click(list().getByRole("option", { name: "Trabalho" }));

    await screen.findByRole("listbox", { name: "Trabalho" });
    expect(list().getByRole("option", { name: "Trabalho" })).toHaveAttribute("aria-selected", "true");
    expect(fake.delivered).toEqual([]);
  });

  it("passar para outra pasta substitui as colunas e voltar a um texto fecha as mais profundas", async () => {
    const user = userEvent.setup();
    await openRoot();

    await hover(user, list().getByRole("option", { name: "Trabalho" }));
    await screen.findByRole("listbox", { name: "Trabalho" });
    await hover(user, sub("Trabalho").getByRole("option", { name: "E-mails" }));
    await screen.findByRole("listbox", { name: "Trabalho › E-mails" });
    expect(columns()).toEqual(["Textos", "Trabalho", "Trabalho › E-mails"]);

    // Um texto da coluna do meio fecha só a mais profunda.
    await hover(user, sub("Trabalho").getByRole("option", { name: "Saudação formal" }));
    await waitFor(() => expect(columns()).toEqual(["Textos", "Trabalho"]));

    // Outra pasta da principal troca tudo dali em diante.
    await hover(user, list().getByRole("option", { name: "Pessoal" }));
    await screen.findByRole("listbox", { name: "Pessoal" });
    expect(columns()).toEqual(["Textos", "Pessoal"]);

    // Um texto da principal fecha todas.
    await hover(user, list().getByRole("option", { name: "Telefone" }));
    await waitFor(() => expect(columns()).toEqual(["Textos"]));
    await waitFor(() => expect(fake.layouts[fake.layouts.length - 1]).toEqual([]));
  });

  it("mexer o mouse sobre a pasta já aberta não pede outro layout", async () => {
    const user = userEvent.setup();
    await openRoot();
    await hover(user, list().getByRole("option", { name: "Trabalho" }));
    await screen.findByRole("listbox", { name: "Trabalho" });

    await hover(user, list().getByRole("option", { name: "Trabalho" }));
    await hover(user, list().getByRole("option", { name: "Trabalho" }));

    expect(columns()).toEqual(["Textos", "Trabalho"]);
    expect(fake.layouts).toHaveLength(1);
  });

  it("as pastas Mais usados e Favoritos também abrem em cascata", async () => {
    const user = userEvent.setup();
    await openRoot();

    await hover(user, list().getByRole("option", { name: "Favoritos" }));

    const column = await screen.findByRole("listbox", { name: "Favoritos" });
    expect(within(column).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Saudação formalTrabalho",
      "Telefone",
    ]);
    await user.click(within(column).getByRole("option", { name: /Telefone/ }));
    expect(fake.delivered).toEqual(["(11) 91234-5678"]);
  });

  it("→ e Enter entram na coluna, ← volta uma coluna e Enter num texto cola", async () => {
    const user = userEvent.setup();
    await openRoot();
    const selected = (box: string) =>
      sub(box)
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-selected") === "true")
        .map((option) => option.textContent);

    await user.keyboard("{ArrowDown}{ArrowRight}");
    await waitFor(() => expect(selected("Trabalho")).toEqual(["E-mails"]));
    expect(optionNames()).not.toContain("=> Trabalho");

    await user.keyboard("{Enter}");
    await waitFor(() => expect(selected("Trabalho › E-mails")).toEqual(["Resposta padrão"]));
    expect(columns()).toEqual(["Textos", "Trabalho", "Trabalho › E-mails"]);

    await user.keyboard("{ArrowDown}");
    expect(selected("Trabalho › E-mails")).toEqual(["Follow-up"]);

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(columns()).toEqual(["Textos", "Trabalho"]));
    expect(selected("Trabalho")).toEqual(["E-mails"]);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(fake.delivered).toEqual(["Prezado(a),"]);

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(optionNames()).toContain("=> Trabalho"));
    expect(columns()).toEqual(["Textos"]);

    // Na coluna principal não há para onde voltar.
    await user.keyboard("{ArrowLeft}");
    expect(optionNames()).toContain("=> Trabalho");
  });

  it("↑ e ↓ fecham as colunas à direita da atual", async () => {
    const user = userEvent.setup();
    await openRoot();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await screen.findByRole("listbox", { name: "Trabalho" });

    await user.keyboard("{ArrowLeft}{ArrowDown}");

    await waitFor(() => expect(columns()).toEqual(["Textos"]));
    expect(optionNames()).toContain("=> Pessoal");
  });

  it("Esc fecha o menu", async () => {
    const user = userEvent.setup();
    const hidePicker = vi.spyOn(api, "hidePicker");
    await openRoot();

    await user.keyboard("{ArrowDown}{ArrowRight}{Escape}");

    expect(hidePicker).toHaveBeenCalled();
  });

  it("digitar na busca fecha as colunas e mostra os resultados numa lista única", async () => {
    const user = userEvent.setup();
    await openRoot();
    await user.click(list().getByRole("option", { name: "Trabalho" }));
    await screen.findByRole("listbox", { name: "Trabalho" });

    await user.keyboard("resp");

    await waitFor(() => expect(optionNames()).toEqual(["=> Resposta padrãoE-mails", "Respostas rápidasPessoal"]));
    expect(columns()).toEqual(["Textos"]);
    await hover(user, list().getByRole("option", { name: /Resposta padrão/ }));
    await wait(450);
    expect(columns()).toEqual(["Textos"]);
  });

  it("o layout reposiciona a coluna principal e uma coluna coberta sai de vista", async () => {
    const user = userEvent.setup();
    await openRoot();
    const main = document.getElementById("picker-column-0");
    api.layoutPicker = vi.fn().mockResolvedValue([
      { x: 300, y: 10, width: 340, height: 440, hidden: true },
      { x: 0, y: 0, width: 300, height: 74, hidden: false },
    ]);

    await user.click(list().getByRole("option", { name: "Trabalho" }));

    const column = await screen.findByRole("listbox", { name: "Trabalho" });
    expect(column.parentElement).not.toHaveAttribute("aria-hidden");
    expect(main).toHaveAttribute("aria-hidden", "true");
    expect(main).toHaveStyle({ left: "300px", top: "10px" });
    // Escondida, a coluna principal ainda guarda o foco do teclado.
    expect(document.activeElement).toBe(main?.querySelector("input"));
  });

  it("cada abertura volta a uma coluna só", async () => {
    const user = userEvent.setup();
    await openRoot();
    await user.click(list().getByRole("option", { name: "Trabalho" }));
    await screen.findByRole("listbox", { name: "Trabalho" });

    act(() => fake.openPicker());

    await waitFor(() => expect(columns()).toEqual(["Textos"]));
    expect(optionNames()[0]).toBe("=> Favoritos");
  });

  it("clicar na área transparente fecha o menu, mas clicar num cartão não", async () => {
    const hidePicker = vi.spyOn(api, "hidePicker");
    await openRoot();
    const pessoal = list().getByRole("option", { name: "Pessoal" });
    const root = pessoal.closest("[id=picker-column-0]")!.parentElement!;

    fireEvent.mouseDown(pessoal);
    expect(hidePicker).not.toHaveBeenCalled();

    fireEvent.mouseDown(root);
    expect(hidePicker).toHaveBeenCalledTimes(1);
  });

  it("mostra o erro do layout sem abrir a coluna", async () => {
    const user = userEvent.setup();
    await openRoot();
    api.layoutPicker = vi.fn().mockRejectedValue("o menu de colagem ainda não foi aberto");

    await user.click(list().getByRole("option", { name: "Trabalho" }));

    expect(await screen.findByText("o menu de colagem ainda não foi aberto")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Trabalho" })).not.toBeInTheDocument();
  });
});
