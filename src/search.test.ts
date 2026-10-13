import { describe, expect, it } from "vitest";

import { excerpt, highlight, searchTerms, titleMatches, type Part } from "./search";

/** Texto com as correspondências entre colchetes. */
function marked(parts: Part[]): string {
  return parts.map((part) => (part.match ? `[${part.text}]` : part.text)).join("");
}

describe("searchTerms", () => {
  it("separa os termos sem acentos e em minúsculas, ignorando símbolos soltos", () => {
    expect(searchTerms("  Ação  * Rápida ")).toEqual(["acao", "rapida"]);
  });
});

describe("highlight", () => {
  it("marca o início de palavras, ignorando acentos e maiúsculas", () => {
    expect(marked(highlight("Informação útil", searchTerms("informa util")))).toBe("[Informa]ção [útil]");
  });

  it("não marca o termo no meio de uma palavra", () => {
    expect(marked(highlight("Proposta comercial", ["posta"]))).toBe("Proposta comercial");
  });

  it("junta correspondências sobrepostas", () => {
    expect(marked(highlight("Resposta", ["res", "resp"]))).toBe("[Resp]osta");
  });
});

describe("titleMatches", () => {
  it("exige todos os termos no título", () => {
    expect(titleMatches("Resposta padrão", ["resp", "padrao"])).toBe(true);
    expect(titleMatches("Resposta padrão", ["resp", "contato"])).toBe(false);
  });
});

describe("excerpt", () => {
  it("mostra o trecho em volta da primeira correspondência, em uma linha", () => {
    const content = "Olá!\n\nObrigado pelo contato. Recebemos sua mensagem e retornaremos em breve.";
    expect(marked(excerpt(content, ["recebe"]))).toBe("…pelo contato. [Recebe]mos sua mensagem e retornaremos em breve.");
  });

  it("começa do início quando a correspondência está perto dele", () => {
    expect(marked(excerpt("Bom dia,\nequipe", ["dia"]))).toBe("Bom [dia], equipe");
  });

  it("devolve vazio sem correspondência", () => {
    expect(excerpt("Bom dia", ["noite"])).toEqual([]);
  });
});
