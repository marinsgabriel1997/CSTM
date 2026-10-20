import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADVANCED_SECTIONS, BASIC_STEPS, HELP_IMPORT_TIP, HELP_INTRO } from "../helpContent";
import HelpPage from "./HelpPage";

afterEach(cleanup);

const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Conta o termo no texto visível: sem negrito/tecla/marcações [n], com o atalho substituído. */
function countIn(texts: string[], term: string): number {
  return texts.reduce((sum, text) => {
    const plain = text.replace(/{atalho}/g, "Alt+Q").replace(/\[\d\]/g, "|").replace(/\*\*|`/g, "");
    return sum + fold(plain).split(fold(term)).length - 1;
  }, 0);
}
const basicTexts = [HELP_IMPORT_TIP, HELP_INTRO, ...BASIC_STEPS.flatMap((s) => [s.title, s.text])];
const advancedTexts = ADVANCED_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs]);

function renderHelp() {
  render(
    <FluentProvider theme={webLightTheme}>
      <HelpPage shortcut="Alt+Q" />
    </FluentProvider>,
  );
}

describe("HelpPage", () => {
  it("mostra as imagens dos passos do Básico", () => {
    renderHelp();
    const images = BASIC_STEPS.flatMap((step) => (step.image ? [step.image] : []));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(screen.getByRole("img", { name: image.alt })).toBeInTheDocument();
    }
  });

  it("mostra as imagens das seções do Avançado", async () => {
    renderHelp();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Avançado" }));
    const images = ADVANCED_SECTIONS.flatMap((section) => (section.image ? [section.image] : []));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(screen.getByRole("img", { name: image.alt })).toBeInTheDocument();
    }
  });

  it("converte [n] na marcação numerada acessível", () => {
    renderHelp();
    expect(screen.getAllByRole("img", { name: "marcação 1" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\[1\]/)).not.toBeInTheDocument();
  });

  it("usa srcset 2x, sem src, nas imagens", () => {
    renderHelp();
    const first = BASIC_STEPS.find((step) => step.image)!.image!;
    const img = screen.getByRole("img", { name: first.alt });
    expect(img.getAttribute("srcset")).toBe(`${first.src} 2x`);
    expect(img).not.toHaveAttribute("src");
  });

  describe("faixa de importação", () => {
    it("aparece no Básico com o texto e o botão", () => {
      renderHelp();
      expect(screen.getByText(HELP_IMPORT_TIP)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver como importar" })).toBeInTheDocument();
    });

    it("leva à seção Importar e exportar no Avançado", async () => {
      const scrollIntoView = vi.fn();
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = scrollIntoView;
      try {
        renderHelp();
        await userEvent.setup().click(screen.getByRole("button", { name: "Ver como importar" }));
        expect(screen.getByRole("tab", { name: /^Avançado/ })).toHaveAttribute("aria-selected", "true");
        const heading = screen.getByRole("heading", { name: "Importar e exportar" });
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(heading.closest("section"));
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
      } finally {
        Element.prototype.scrollIntoView = original;
      }
    });

    it("entra na contagem da busca do Básico", async () => {
      const term = "Windows e arquivos";
      expect(countIn(basicTexts, term)).toBe(1);
      expect(countIn(basicTexts.slice(1), term)).toBe(0);
      renderHelp();
      await userEvent.setup().type(screen.getByRole("searchbox"), term);
      expect(screen.getByRole("tabpanel", { name: "Básico" }).querySelectorAll("mark")).toHaveLength(1);
      expect(within(screen.getByRole("tab", { name: /^Básico/ })).getAllByText("1").length).toBeGreaterThan(0);
    });
  });

  describe("busca", () => {
    const term = "texto";
    const basic = countIn(basicTexts, term);
    const advanced = countIn(advancedTexts, term);

    it("conta as ocorrências no total e por aba", async () => {
      expect(basic).toBeGreaterThan(0);
      expect(advanced).toBeGreaterThan(0);
      renderHelp();
      await userEvent.setup().type(screen.getByRole("searchbox", { name: "Buscar na Ajuda" }), term);
      expect(screen.getByText(`1 de ${basic + advanced}`)).toBeInTheDocument();
      expect(within(screen.getByRole("tab", { name: /^Básico/ })).getAllByText(String(basic)).length).toBeGreaterThan(0);
      expect(within(screen.getByRole("tab", { name: /^Avançado/ })).getAllByText(String(advanced)).length).toBeGreaterThan(0);
      expect(screen.getByRole("tabpanel", { name: "Básico" }).querySelectorAll("mark")).toHaveLength(basic);
    });

    it("ignora acentos e maiúsculas", async () => {
      const expected = countIn(basicTexts, "area") + countIn(advancedTexts, "area");
      expect(expected).toBeGreaterThan(0);
      renderHelp();
      await userEvent.setup().type(screen.getByRole("searchbox"), "ÁREA");
      expect(screen.getByText(new RegExp(`^1 de ${expected}$`))).toBeInTheDocument();
    });

    it("avança para a outra aba e volta circularmente", async () => {
      renderHelp();
      const user = userEvent.setup();
      await user.type(screen.getByRole("searchbox"), term);
      for (let i = 0; i < basic; i++) await user.click(screen.getByRole("button", { name: "Próxima" }));
      expect(screen.getByRole("tab", { name: /^Avançado/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText(`${basic + 1} de ${basic + advanced}`)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Anterior" }));
      expect(screen.getByRole("tab", { name: /^Básico/ })).toHaveAttribute("aria-selected", "true");
      // Volta circular a partir da primeira.
      await user.click(screen.getByRole("tab", { name: /^Básico/ }));
      for (let i = 0; i < basic - 1; i++) await user.click(screen.getByRole("button", { name: "Anterior" }));
      await user.click(screen.getByRole("button", { name: "Anterior" }));
      expect(screen.getByText(`${basic + advanced} de ${basic + advanced}`)).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Avançado/ })).toHaveAttribute("aria-selected", "true");
    });

    it("Enter e Shift+Enter navegam", async () => {
      renderHelp();
      const user = userEvent.setup();
      await user.type(screen.getByRole("searchbox"), term);
      await user.keyboard("{Enter}");
      expect(screen.getByText(`2 de ${basic + advanced}`)).toBeInTheDocument();
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      expect(screen.getByText(`1 de ${basic + advanced}`)).toBeInTheDocument();
    });

    it("Esc limpa o termo", async () => {
      renderHelp();
      const user = userEvent.setup();
      const box = screen.getByRole("searchbox");
      await user.type(box, term);
      await user.keyboard("{Escape}");
      expect(box).toHaveValue("");
      expect(screen.queryByText(/ de \d+/)).not.toBeInTheDocument();
    });

    it("mostra Nenhum resultado e desabilita os botões", async () => {
      renderHelp();
      expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
      await userEvent.setup().type(screen.getByRole("searchbox"), "zzzqqq");
      expect(screen.getByText("Nenhum resultado")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    });

    it("permite trocar de aba manualmente com a busca ativa", async () => {
      renderHelp();
      const user = userEvent.setup();
      await user.type(screen.getByRole("searchbox"), term);
      await user.click(screen.getByRole("tab", { name: /^Avançado/ }));
      expect(screen.getByRole("tabpanel", { name: "Avançado" }).querySelectorAll("mark")).toHaveLength(advanced);
    });
  });
});
