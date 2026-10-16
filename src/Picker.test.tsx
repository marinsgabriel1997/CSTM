import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("copiar", () => {
  it("o botão Copiar aparece só na linha de texto selecionada e copia sem colar", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    const phone = await list().findByRole("option", { name: "Telefone" });
    // Favoritos começa selecionada: pastas não têm o botão.
    expect(list().queryByRole("button", { name: /^Copiar/ })).not.toBeInTheDocument();

    await hover(user, phone);
    const copy = within(phone).getByRole("button", { name: "Copiar Telefone" });
    expect(list().getAllByRole("button", { name: /^Copiar/ })).toHaveLength(1);
    expect(copy).toHaveAttribute("title", "Copiar (Ctrl+C)");
    // O botão não muda o nome da linha.
    expect(list().getByRole("option", { name: "Telefone" })).toBe(phone);
    await user.click(copy);

    expect(fake.copied).toEqual(["(11) 91234-5678"]);
    expect(fake.delivered).toEqual([]);
    // Copiar pelo menu conta como uso.
    expect(fake.snippets.find((s) => s.title === "Telefone")?.useCount).toBe(1);
    expect(search()).toHaveFocus();
  });

  it("Ctrl+C copia o texto selecionado, mas não uma pasta", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.keyboard("{Control>}c{/Control}");
    expect(fake.copied).toEqual([]);

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Control>}c{/Control}");
    expect(optionNames()[3]).toBe("=> Telefone");
    expect(fake.copied).toEqual(["(11) 91234-5678"]);
    expect(fake.delivered).toEqual([]);
  });

  it("com um trecho da busca selecionado, Ctrl+C não copia o texto da lista", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Trabalho" });

    await user.type(search(), "telefone");
    await screen.findByText("Telefone");
    await user.keyboard("{Control>}a{/Control}{Control>}c{/Control}");
    expect(fake.copied).toEqual([]);

    // Sem seleção na busca, copia o resultado selecionado.
    await user.keyboard("{End}{Control>}c{/Control}");
    expect(fake.copied).toEqual(["(11) 91234-5678"]);
  });

  it("mostra o erro quando o texto não pode ser copiado", async () => {
    const user = userEvent.setup();
    await fake.api.createSnippet(null, "Telefone", "1234");
    api.copySnippet = vi.fn().mockRejectedValue("não foi possível copiar o texto");
    renderPicker();
    await list().findByRole("option", { name: "Telefone" });

    await user.keyboard("{Control>}c{/Control}");

    expect(await screen.findByText("não foi possível copiar o texto")).toBeInTheDocument();
  });
});

describe("histórico do clipboard", () => {
  /** Histórico com um texto e uma imagem, a imagem copiada por último. */
  function seedHistory() {
    fake.copyElsewhere({ title: "Reunião às 15h", preview: "Reunião às 15h\nLevar o relatório." });
    fake.copyElsewhere({
      kind: "image",
      title: "Imagem 1920 × 1080",
      preview: "Imagem 1920 × 1080",
      thumbnail: "data:image/png;base64,iVBORw0KGgo=",
      width: 1920,
      height: 1080,
    });
  }

  it("a pasta Histórico vem antes de Mais usados e Favoritos e lista o mais recente primeiro", async () => {
    const user = userEvent.setup();
    await seed();
    await fake.api.chooseSnippet(fake.snippets[0].id);
    seedHistory();
    renderPicker();

    await list().findByRole("option", { name: "Histórico" });
    expect(optionNames().slice(0, 3)).toEqual(["=> Histórico", "Mais usados", "Favoritos"]);

    await user.keyboard("{Enter}");
    await list().findByRole("option", { name: /Imagem 1920 × 1080/ });
    expect(optionNames()).toEqual(["=> Imagem 1920 × 108001/01", "Reunião às 15h01/01"]);
    const image = list().getByRole("option", { name: /Imagem/ });
    expect(image.querySelector("img")).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(list().getByRole("option", { name: /Reunião/ })).toHaveAttribute(
      "title",
      "Reunião às 15h\nLevar o relatório.",
    );
    // A busca não inclui o histórico.
    await user.type(search(), "reunião");
    expect(await screen.findByText("Nenhum texto encontrado.")).toBeInTheDocument();
  });

  it("Enter cola o item e o leva ao topo; Copiar e Ctrl+C copiam sem colar", async () => {
    const user = userEvent.setup();
    seedHistory();
    const [image, text] = fake.history;
    renderPicker();
    await user.click(await list().findByRole("option", { name: "Histórico" }));
    await list().findByRole("option", { name: /Reunião/ });

    await user.keyboard("{ArrowDown}{Enter}");
    expect(fake.historyPasted).toEqual([text.id]);
    expect(fake.history.map((item) => item.id)).toEqual([text.id, image.id]);
    expect(fake.delivered).toEqual([]);

    // A seleção acompanha o item, que agora está no topo.
    await waitFor(() => expect(optionNames()[0]).toMatch(/^=> Reunião/));
    await user.keyboard("{Control>}c{/Control}");
    expect(fake.historyCopied).toEqual([text.id]);

    const imageRow = list().getByRole("option", { name: /Imagem/ });
    await hover(user, imageRow);
    await user.click(within(imageRow).getByRole("button", { name: "Copiar Imagem 1920 × 1080" }));
    expect(fake.historyCopied).toEqual([text.id, image.id]);
    expect(fake.copied).toEqual([]);
  });

  it("some com o histórico vazio ou desligado", async () => {
    await fake.api.createSnippet(null, "Telefone", "1234");
    renderPicker();
    await list().findByRole("option", { name: "Telefone" });
    expect(optionNames()).toEqual(["=> Telefone"]);

    cleanup();
    seedHistory();
    fake.historyState.monitoring = false;
    renderPicker();
    await list().findByRole("option", { name: "Telefone" });
    expect(optionNames()).toEqual(["=> Telefone"]);
  });

  it("uma cópia feita com o menu aberto aparece no Histórico", async () => {
    const user = userEvent.setup();
    seedHistory();
    renderPicker();
    await user.click(await list().findByRole("option", { name: "Histórico" }));
    await list().findByRole("option", { name: /Reunião/ });

    act(() => void fake.copyElsewhere({ title: "Novo item" }));

    expect(await list().findByRole("option", { name: /Novo item/ })).toBeInTheDocument();
    expect(optionNames()).toHaveLength(3);
  });

  it("abre em cascata como as outras pastas virtuais", async () => {
    const user = userEvent.setup();
    fake.setNavigation("cascade");
    seedHistory();
    renderPicker();

    await hover(user, await list().findByRole("option", { name: "Histórico" }));

    const column = await screen.findByRole("listbox", { name: "Histórico" });
    await user.click(within(column).getByRole("option", { name: /Reunião/ }));
    expect(fake.historyPasted).toEqual([fake.history[0].id]);
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
      "Resposta padrão\n\nTrabalho › E-mails\n\nObrigado pelo contato.",
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(fake.delivered).toEqual(["Pode deixar."]);
  });

  it("quebra o título em até 2 linhas e mantém a pasta em uma linha, para não invadir as linhas vizinhas", async () => {
    const user = userEvent.setup();
    const folder = await fake.api.createFolder(null, "Sistemas de Apoio");
    await fake.api.createSnippet(folder.id, "Plataforma Bry - Erro assinatura de coleta", "Texto");
    renderPicker();
    await list().findByRole("option", { name: "Sistemas de Apoio" });

    await user.keyboard("assinatura");

    const option = await list().findByRole("option", { name: /Plataforma Bry/ });
    const title = getComputedStyle(within(option).getByText("Plataforma Bry - Erro assinatura de coleta"));
    expect(title.whiteSpace).not.toBe("nowrap");
    expect(title.overflowWrap).toBe("anywhere");
    expect(getComputedStyle(within(option).getByText("Sistemas de Apoio")).whiteSpace).toBe("nowrap");
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

  it("põe a coluna principal onde a abertura indicou e avisa depois de desenhá-la", async () => {
    await seed();
    renderPicker();
    await list().findByRole("option", { name: "Pessoal" });
    expect(fake.picker.readies).toBe(0);

    act(() => fake.openPicker({ x: 500, y: 200 }));

    expect(document.getElementById("picker-column-0")).toHaveStyle({ left: "500px", top: "200px", width: "420px" });
    await waitFor(() => expect(fake.picker.readies).toBe(1));

    act(() => fake.openPicker({ x: 40, y: 600 }));

    expect(document.getElementById("picker-column-0")).toHaveStyle({ left: "40px", top: "600px" });
    await waitFor(() => expect(fake.picker.readies).toBe(2));
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
    // O campo de busca (41 px), a pasta E-mails (32 px), o texto Saudação formal (36 px, com o Copiar) e a margem da lista.
    expect(fake.layouts).toEqual([[{ contentHeight: 41 + 32 + 36 + 10 }]]);
    // A posição vem do backend.
    expect(column.parentElement).toHaveStyle({ left: "422px", width: "380px", height: `${41 + 32 + 36 + 10}px` });
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
      { x: 300, y: 10, width: 420, height: 440, hidden: true },
      { x: 0, y: 0, width: 380, height: 74, hidden: false },
    ]);

    await user.click(list().getByRole("option", { name: "Trabalho" }));

    const column = await screen.findByRole("listbox", { name: "Trabalho" });
    expect(column.parentElement).not.toHaveAttribute("aria-hidden");
    expect(main).toHaveAttribute("aria-hidden", "true");
    expect(main).toHaveStyle({ left: "300px", top: "10px" });
    // Escondida, a coluna principal ainda guarda o foco do teclado.
    expect(document.activeElement).toBe(main?.querySelector("input"));
  });

  it("as subcolunas abrem a partir da coluna principal da abertura", async () => {
    const user = userEvent.setup();
    await openRoot();
    act(() => fake.openPicker({ x: 500, y: 200 }));

    await hover(user, list().getByRole("option", { name: "Trabalho" }));

    const column = await screen.findByRole("listbox", { name: "Trabalho" });
    // À direita da principal (500 + 420 + 2), com o topo no da principal.
    expect(column.parentElement).toHaveStyle({ left: "922px", top: "200px" });
    expect(document.getElementById("picker-column-0")).toHaveStyle({ left: "500px", top: "200px" });
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

  describe("busca dentro da coluna", () => {
    const field = (name: string) => screen.getByRole("combobox", { name: `Buscar em ${name}` });
    const names = (box: string) => sub(box).getAllByRole("option").map((option) => option.textContent);

    async function openFolder(user: ReturnType<typeof userEvent.setup>, name: string) {
      await user.click(list().getByRole("option", { name }));
      await screen.findByRole("listbox", { name });
    }

    it("cada subcoluna tem o campo de busca com o nome da pasta", async () => {
      const user = userEvent.setup();
      await openRoot();

      await openFolder(user, "Trabalho");

      expect(screen.getByPlaceholderText("Buscar em Trabalho")).toBeInTheDocument();
      expect(field("Trabalho")).toHaveAttribute("aria-controls", "picker-list-1");
      // O foco continua no campo principal.
      expect(search()).toHaveFocus();
    });

    it("numa pasta real encontra textos das subpastas e mostra a subpasta só quando não é a da coluna", async () => {
      const user = userEvent.setup();
      await openRoot();
      await openFolder(user, "Trabalho");

      await user.type(field("Trabalho"), "resp");
      await waitFor(() => expect(names("Trabalho")).toEqual(["Resposta padrãoE-mails"]));
      expect(sub("Trabalho").getByRole("option")).toHaveAttribute(
        "title",
        "Resposta padrão\n\nTrabalho › E-mails\n\nObrigado pelo contato.",
      );

      await user.clear(field("Trabalho"));
      await user.type(field("Trabalho"), "saud");
      await waitFor(() => expect(names("Trabalho")).toEqual(["Saudação formal"]));
      expect(sub("Trabalho").getByRole("option")).toHaveAttribute("title", "Saudação formal\n\nTrabalho\n\nPrezado(a),");
    });

    it("em Favoritos filtra os textos da lista, com a pasta de cada um", async () => {
      const user = userEvent.setup();
      await openRoot();
      await openFolder(user, "Favoritos");

      await user.type(field("Favoritos"), "sau");
      await waitFor(() => expect(names("Favoritos")).toEqual(["Saudação formalTrabalho"]));

      // Textos que bateriam com a busca, mas não são favoritos, ficam de fora.
      await user.clear(field("Favoritos"));
      await user.type(field("Favoritos"), "resp");
      expect(await sub("Favoritos").findByText("Nenhum texto encontrado.")).toBeInTheDocument();
    });

    it("no Histórico filtra os itens já carregados, sem acento nem caixa", async () => {
      const user = userEvent.setup();
      fake.copyElsewhere({ title: "Reunião às 15h", preview: "Reunião às 15h\nLevar o relatório." });
      fake.copyElsewhere({ title: "Orçamento do mês", preview: "Orçamento do mês" });
      await openRoot();
      await openFolder(user, "Histórico");

      await user.type(field("Histórico"), "REUNIAO relat");

      await waitFor(() => expect(names("Histórico")).toHaveLength(1));
      expect(names("Histórico")[0]).toMatch(/^Reunião às 15h/);
    });

    it("→ numa pasta leva o foco ao campo da coluna nova, onde digitar filtra", async () => {
      const user = userEvent.setup();
      await openRoot();

      await user.keyboard("{ArrowDown}{ArrowRight}");
      await waitFor(() => expect(field("Trabalho")).toHaveFocus());
      expect(field("Trabalho")).toHaveAttribute("aria-activedescendant");
      expect(search()).not.toHaveAttribute("aria-activedescendant");

      await user.keyboard("resp");
      await waitFor(() => expect(names("Trabalho")).toEqual(["Resposta padrãoE-mails"]));
      expect(sub("Trabalho").getByRole("option")).toHaveAttribute("aria-selected", "true");
      // Setas laterais só navegam com o campo vazio.
      await user.keyboard("{ArrowLeft}");
      expect(field("Trabalho")).toHaveFocus();
    });

    it("← com o campo vazio fecha a coluna e devolve o foco ao campo da coluna anterior", async () => {
      const user = userEvent.setup();
      await openRoot();
      await user.keyboard("{ArrowDown}{ArrowRight}");
      await waitFor(() => expect(field("Trabalho")).toHaveFocus());
      await user.keyboard("{Enter}");
      await waitFor(() => expect(field("E-mails")).toHaveFocus());

      await user.keyboard("{ArrowLeft}");
      await waitFor(() => expect(columns()).toEqual(["Textos", "Trabalho"]));
      expect(field("Trabalho")).toHaveFocus();

      await user.keyboard("{Backspace}");
      await waitFor(() => expect(columns()).toEqual(["Textos"]));
      expect(search()).toHaveFocus();
    });

    it("filtrar fecha as colunas à direita e seleciona o primeiro resultado", async () => {
      const user = userEvent.setup();
      await openRoot();
      await openFolder(user, "Trabalho");
      await user.click(sub("Trabalho").getByRole("option", { name: "E-mails" }));
      await screen.findByRole("listbox", { name: "Trabalho › E-mails" });

      await user.type(field("Trabalho"), "s");

      await waitFor(() => expect(columns()).toEqual(["Textos", "Trabalho"]));
      await waitFor(() => expect(sub("Trabalho").getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true"));
    });

    it("o botão ✕ limpa o filtro e mantém o foco no campo", async () => {
      const user = userEvent.setup();
      await openRoot();
      await openFolder(user, "Trabalho");
      expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument();

      await user.type(field("Trabalho"), "resp");
      await waitFor(() => expect(names("Trabalho")).toHaveLength(1));
      await user.click(screen.getByRole("button", { name: "Limpar busca" }));

      expect(field("Trabalho")).toHaveValue("");
      expect(field("Trabalho")).toHaveFocus();
      await waitFor(() => expect(names("Trabalho")).toEqual(["E-mails", "Saudação formal"]));
      expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument();
    });

    it("Esc no campo da subcoluna fecha o menu", async () => {
      const user = userEvent.setup();
      const hidePicker = vi.spyOn(api, "hidePicker");
      await openRoot();
      await openFolder(user, "Trabalho");

      await user.type(field("Trabalho"), "{Escape}");

      expect(hidePicker).toHaveBeenCalled();
    });

    it("informa quando o filtro não encontra nada", async () => {
      const user = userEvent.setup();
      await openRoot();
      await openFolder(user, "Trabalho");

      await user.type(field("Trabalho"), "orçamento");

      expect(await sub("Trabalho").findByText("Nenhum texto encontrado.")).toBeInTheDocument();
    });
  });
});

describe("títulos longos", () => {
  const longTitle = "Resposta padrão para pedidos de orçamento enviados pelo formulário do site";
  const veryLongTitle = `${longTitle} ${longTitle} ${longTitle}`;

  it("a dica de um texto da pasta tem o título e o conteúdo, separados por linha em branco", async () => {
    const user = userEvent.setup();
    fake.setNavigation("click");
    const folder = await fake.api.createFolder(null, "Pasta");
    await fake.api.createSnippet(folder.id, longTitle, "Conteúdo do texto.");
    renderPicker();

    await user.click(await list().findByRole("option", { name: "Pasta" }));

    expect(await list().findByRole("option", { name: longTitle })).toHaveAttribute(
      "title",
      `${longTitle}\n\nConteúdo do texto.`,
    );
  });

  it("a dica de um resultado da busca tem título, caminho e conteúdo", async () => {
    const user = userEvent.setup();
    fake.setNavigation("click");
    const folder = await fake.api.createFolder(null, "Pasta");
    await fake.api.createSnippet(folder.id, longTitle, "Conteúdo do texto.");
    renderPicker();
    await list().findByRole("option", { name: "Pasta" });

    await user.type(search(), "orçamento");

    expect(await list().findByRole("option", { name: new RegExp(longTitle) })).toHaveAttribute(
      "title",
      `${longTitle}\n\nPasta\n\nConteúdo do texto.`,
    );
  });

  it("a altura pedida para a coluna conta 2 linhas nos títulos longos e 1 nos curtos", async () => {
    const user = userEvent.setup();
    fake.setNavigation("cascade");
    const folder = await fake.api.createFolder(null, "Pasta");
    await fake.api.createSnippet(folder.id, "Curto", "a");
    await fake.api.createSnippet(folder.id, longTitle, "b");
    await fake.api.createSnippet(folder.id, veryLongTitle, "c");
    // Uma palavra só, maior que a linha, também para em 2 linhas.
    await fake.api.createSnippet(folder.id, "x".repeat(200), "d");
    renderPicker();

    await hover(user, await list().findByRole("option", { name: "Pasta" }));

    await screen.findByRole("listbox", { name: "Pasta" });
    // Busca (41 px), um texto de uma linha de 36 px (com o Copiar), três de 52 px (2 linhas de 20 px mais 12 px) e a margem da lista.
    expect(fake.layouts).toEqual([[{ contentHeight: 41 + 36 + 3 * 52 + 10 }]]);
  });

  it("textos de título curto têm linhas de 36 px (com o Copiar)", async () => {
    const user = userEvent.setup();
    fake.setNavigation("cascade");
    const folder = await fake.api.createFolder(null, "Pasta");
    await fake.api.createSnippet(folder.id, "Um", "a");
    await fake.api.createSnippet(folder.id, "Dois", "b");
    renderPicker();

    await hover(user, await list().findByRole("option", { name: "Pasta" }));

    await screen.findByRole("listbox", { name: "Pasta" });
    expect(fake.layouts).toEqual([[{ contentHeight: 41 + 2 * 36 + 10 }]]);
  });

  it("três textos de título curto pedem 41 + 3 × 36 + 10", async () => {
    const user = userEvent.setup();
    fake.setNavigation("cascade");
    const folder = await fake.api.createFolder(null, "Pasta");
    await fake.api.createSnippet(folder.id, "Um", "a");
    await fake.api.createSnippet(folder.id, "Dois", "b");
    await fake.api.createSnippet(folder.id, "Três", "c");
    renderPicker();

    await hover(user, await list().findByRole("option", { name: "Pasta" }));

    await screen.findByRole("listbox", { name: "Pasta" });
    expect(fake.layouts).toEqual([[{ contentHeight: 41 + 3 * 36 + 10 }]]);
  });
});

describe("modos de colagem", () => {
  const modeNames = ["Colar como markdown", "Colar sem formatação", "Colar formatado", "Colar para o Google Chat"];
  const modeButtons = () => screen.queryAllByRole("button", { name: /^Colar / }).map((button) => button.getAttribute("aria-label"));

  it("a linha de texto selecionada oferece os três modos além do padrão, e só ela", async () => {
    await seed();
    renderPicker();
    const link = await list().findByRole("option", { name: "Link da agenda" });

    // A seleção começa numa pasta: sem botões.
    expect(modeButtons()).toEqual([]);
    await userEvent.setup().hover(link);

    expect(modeButtons()).toEqual(modeNames.slice(1));
    expect(within(link).getAllByRole("button")).toHaveLength(4);
  });

  it("omite o modo que é o padrão", async () => {
    fake.setDefaultPasteFormat("chat");
    await seed();
    renderPicker();
    await userEvent.setup().hover(await list().findByRole("option", { name: "Link da agenda" }));

    expect(modeButtons()).toEqual(modeNames.slice(0, 3));
  });

  it("o clique cola no modo do botão, sem tirar o foco da busca; Enter usa o padrão", async () => {
    const user = userEvent.setup();
    await seed();
    renderPicker();
    const link = await list().findByRole("option", { name: "Link da agenda" });
    await user.hover(link);

    await user.click(screen.getByRole("button", { name: "Colar para o Google Chat" }));

    expect(fake.delivered).toEqual(["https://agenda.exemplo.com"]);
    expect(fake.deliveredFormats).toEqual(["chat"]);
    expect(search()).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Colar sem formatação" }));
    await user.keyboard("{Enter}");
    expect(fake.deliveredFormats).toEqual(["chat", "plain", undefined]);
  });

  it("no Histórico, o texto selecionado oferece os quatro modos e a imagem nenhum", async () => {
    const user = userEvent.setup();
    fake.setDefaultPasteFormat("chat");
    fake.copyElsewhere({ title: "Reunião às 15h" });
    fake.copyElsewhere({ kind: "image", title: "Imagem 1 × 1", preview: "Imagem 1 × 1", thumbnail: "data:image/png;base64,AA==" });
    renderPicker();
    await user.click(await list().findByRole("option", { name: "Histórico" }));
    const image = await list().findByRole("option", { name: /Imagem/ });
    const text = list().getByRole("option", { name: /Reunião/ });

    await user.hover(image);
    expect(modeButtons()).toEqual([]);
    await user.hover(text);
    expect(modeButtons()).toEqual(modeNames);
  });

  it("no Histórico, o botão cola no modo escolhido; Enter e Copiar usam o original", async () => {
    const user = userEvent.setup();
    fake.copyElsewhere({ title: "Reunião às 15h" });
    const [item] = fake.history;
    renderPicker();
    await user.click(await list().findByRole("option", { name: "Histórico" }));
    await user.hover(await list().findByRole("option", { name: /Reunião/ }));

    await user.click(screen.getByRole("button", { name: "Colar para o Google Chat" }));
    expect(fake.historyPasted).toEqual([item.id]);
    expect(fake.historyPastedFormats).toEqual(["chat"]);
    expect(search()).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(fake.historyPastedFormats).toEqual(["chat", undefined]);

    await user.click(screen.getByRole("button", { name: /^Copiar / }));
    expect(fake.historyCopied).toEqual([item.id]);
    expect(fake.historyPastedFormats).toEqual(["chat", undefined]);
  });
});
