import { describe, expect, it } from "vitest";

import type { Folder, Snippet } from "./api";
import { groupOrder, insertInto, sortedOrder } from "./operations";

function folder(id: number, name: string, sortOrder: number): Folder {
  return { id, parentId: null, name, sortOrder, createdAt: "", updatedAt: "" };
}

function snippet(id: number, title: string, sortOrder: number, useCount = 0, lastUsedAt: string | null = null): Snippet {
  return {
    id,
    folderId: null,
    title,
    content: "",
    favorite: false,
    useCount,
    lastUsedAt,
    sortOrder,
    createdAt: "",
    updatedAt: "",
  };
}

const folders = [folder(1, "Trabalho", 0), folder(2, "área", 1), folder(3, "Pasta 10", 2), folder(4, "Pasta 9", 3)];
const snippets = [
  snippet(10, "Telefone", 0, 2, "2026-10-01T10:00:00.000Z"),
  snippet(11, "Assinatura", 1, 5, "2026-09-01T10:00:00.000Z"),
  snippet(12, "Endereço", 2),
  snippet(13, "Agenda", 3, 2, "2026-10-10T10:00:00.000Z"),
  // Texto novo ainda não gravado: fica fora das ordens enviadas ao backend.
  snippet(-1, "Rascunho", 4),
];

describe("groupOrder", () => {
  it("guarda a ordem manual do grupo, sem os textos não gravados", () => {
    expect(groupOrder(folders, snippets, null)).toEqual({
      parentId: null,
      folderIds: [1, 2, 3, 4],
      snippetIds: [10, 11, 12, 13],
    });
  });
});

describe("sortedOrder", () => {
  it("ordena pastas e textos por nome, sem diferenciar acentos e com números em ordem natural", () => {
    expect(sortedOrder(folders, snippets, null, "name")).toMatchObject({
      folderIds: [2, 4, 3, 1],
      snippetIds: [13, 11, 12, 10],
    });
  });

  it("ordena os textos por mais usados e por uso mais recente; pastas continuam por nome", () => {
    expect(sortedOrder(folders, snippets, null, "uses")).toMatchObject({
      folderIds: [2, 4, 3, 1],
      snippetIds: [11, 13, 10, 12],
    });
    expect(sortedOrder(folders, snippets, null, "recent").snippetIds).toEqual([13, 10, 11, 12]);
  });
});

describe("insertInto", () => {
  const order = { parentId: null, folderIds: [1, 2, 3], snippetIds: [10, 11, 12] };

  it("insere antes do item indicado, tirando os itens de onde estavam", () => {
    expect(
      insertInto(order, [{ kind: "snippet", id: 12 }, { kind: "folder", id: 7 }], { kind: "snippet", id: 10 }),
    ).toEqual({ parentId: null, folderIds: [1, 2, 3, 7], snippetIds: [12, 10, 11] });
  });

  it("sem posição, ou com a posição num item movido, coloca no fim do tipo", () => {
    expect(insertInto(order, [{ kind: "folder", id: 1 }], null).folderIds).toEqual([2, 3, 1]);
    expect(insertInto(order, [{ kind: "folder", id: 1 }], { kind: "folder", id: 1 }).folderIds).toEqual([2, 3, 1]);
  });
});
