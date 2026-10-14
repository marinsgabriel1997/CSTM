import { describe, expect, it } from "vitest";

import type { TransferSummary } from "./api";
import { exportNotice, importFailure, importNotice, MAX_LISTED_SKIPS } from "./transfer";

function summary(changes: Partial<TransferSummary>): TransferSummary {
  return { folders: 0, snippets: 0, skipped: [], path: null, ...changes };
}

describe("avisos de importação e exportação", () => {
  it("concorda a quantidade de textos e pastas", () => {
    expect(importNotice(summary({ snippets: 1 }), null).title).toBe("1 texto importado na raiz.");
    expect(importNotice(summary({ snippets: 2, folders: 1 }), "Trabalho").title).toBe(
      "2 textos e 1 pasta importados em Trabalho.",
    );
    expect(importNotice(summary({ folders: 1 }), null).title).toBe("1 pasta importada na raiz.");
    expect(importNotice(summary({ folders: 3 }), null).title).toBe("3 pastas importadas na raiz.");
    expect(importNotice(summary({}), null).title).toBe("Nenhum texto importado na raiz.");
    expect(exportNotice(summary({ snippets: 9, folders: 4, path: "C:\\CSTM" }))).toEqual({
      intent: "success",
      title: "9 textos e 4 pastas exportados.",
      details: "C:\\CSTM",
    });
  });

  it("lista os arquivos ignorados com o motivo, resumindo os excedentes", () => {
    const one = importNotice(summary({ skipped: [{ path: "ansi.txt", reason: "notUtf8" }] }), null);
    expect(one.details).toBe("1 arquivo ignorado:");
    expect(one.items).toEqual(["ansi.txt: não está em UTF-8"]);

    const skipped = Array.from({ length: MAX_LISTED_SKIPS + 3 }, (_, i) => ({ path: `${i}.png`, reason: "notTxt" as const }));
    const many = importNotice(summary({ skipped }), null);
    expect(many.details).toBe(`${MAX_LISTED_SKIPS + 3} arquivos ignorados:`);
    expect(many.items).toHaveLength(MAX_LISTED_SKIPS + 1);
    expect(many.items?.[MAX_LISTED_SKIPS]).toBe("e mais 3");
  });

  it("explica a falha da importação", () => {
    expect(importFailure("o arquivo não é um backup do CSTM")).toEqual({
      intent: "error",
      title: "Não foi possível importar.",
      details: "O arquivo não é um backup do CSTM. Nada foi importado.",
    });
  });
});
