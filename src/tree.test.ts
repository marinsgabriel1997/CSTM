import { describe, expect, it } from "vitest";

import type { Folder, Snippet } from "./api";
import {
  buildTree,
  filterTree,
  folderContents,
  folderOptions,
  folderPath,
  subtreeIds,
  topLevel,
  visibleItems,
  type TreeNode,
} from "./tree";

function folder(id: number, parentId: number | null, sortOrder: number): Folder {
  return { id, parentId, name: `Pasta ${id}`, sortOrder, createdAt: "", updatedAt: "" };
}

function snippet(id: number, folderId: number | null, sortOrder: number, favorite = false): Snippet {
  return {
    id,
    folderId,
    title: `Texto ${id}`,
    content: "",
    favorite,
    useCount: 0,
    lastUsedAt: null,
    sortOrder,
    createdAt: "",
    updatedAt: "",
  };
}

// 1 ─┬─ 3 ── 5
//    └─ 4
// 2
const folders = [folder(4, 1, 1), folder(5, 3, 0), folder(2, null, 1), folder(3, 1, 0), folder(1, null, 0)];

const snippets = [
  snippet(11, null, 1),
  snippet(12, 1, 0, true),
  snippet(10, null, 0),
  snippet(13, 5, 0, true),
  snippet(14, 4, 0),
];

/** Forma compacta da árvore: `["p1", [...]]` para pastas e `"t10"` para textos. */
function shape(nodes: TreeNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === "folder" ? [`p${node.folder.id}`, shape(node.children)] : `t${node.snippet.id}`,
  );
}

describe("buildTree", () => {
  it("põe as pastas antes dos textos, cada grupo na ordem manual", () => {
    expect(shape(buildTree(folders, snippets))).toEqual([
      ["p1", [["p3", [["p5", ["t13"]]]], ["p4", ["t14"]], "t12"]],
      ["p2", []],
      "t10",
      "t11",
    ]);
  });

  it("desempata pela ordem de criação quando sort_order se repete", () => {
    const tree = buildTree([folder(7, null, 0), folder(6, null, 0)], [snippet(9, null, 0), snippet(8, null, 0)]);
    expect(shape(tree)).toEqual([["p6", []], ["p7", []], "t8", "t9"]);
  });

  it("devolve lista vazia sem pastas nem textos", () => {
    expect(buildTree([], [])).toEqual([]);
  });
});

describe("filterTree", () => {
  it("mantém os textos aceitos e somente as pastas que levam a eles", () => {
    const favorites = filterTree(buildTree(folders, snippets), (item) => item.favorite);
    expect(shape(favorites)).toEqual([["p1", [["p3", [["p5", ["t13"]]]], "t12"]]]);
  });

  it("devolve lista vazia quando nada é aceito", () => {
    expect(filterTree(buildTree(folders, snippets), () => false)).toEqual([]);
  });
});

describe("folderOptions", () => {
  it("lista as pastas na ordem da árvore com a profundidade", () => {
    expect(folderOptions(folders).map(({ id, depth }) => [id, depth])).toEqual([
      [1, 0],
      [3, 1],
      [5, 2],
      [4, 1],
      [2, 0],
    ]);
  });
});

describe("subtreeIds", () => {
  it("inclui a pasta e todas as descendentes", () => {
    expect([...subtreeIds(folders, 1)].sort()).toEqual([1, 3, 4, 5]);
    expect([...subtreeIds(folders, 2)]).toEqual([2]);
  });
});

describe("folderPath", () => {
  it("lista as pastas da raiz até a pasta pedida", () => {
    expect(folderPath(folders, 5).map((item) => item.id)).toEqual([1, 3, 5]);
    expect(folderPath(folders, null)).toEqual([]);
  });
});

describe("folderContents", () => {
  it("conta subpastas, textos e favoritos de toda a subárvore", () => {
    expect(folderContents(folders, snippets, 1)).toEqual({ folders: 3, snippets: 3, favorites: 2 });
    expect(folderContents(folders, snippets, 2)).toEqual({ folders: 0, snippets: 0, favorites: 0 });
  });
});

describe("visibleItems", () => {
  it("segue a ordem da tela, entrando só nas pastas abertas", () => {
    const nodes = buildTree(folders, snippets);
    const key = ({ kind, id }: { kind: string; id: number }) => `${kind === "folder" ? "p" : "t"}${id}`;
    expect(visibleItems(nodes, () => true).map(key)).toEqual(["p1", "p3", "p5", "t13", "p4", "t14", "t12", "p2", "t10", "t11"]);
    expect(visibleItems(nodes, (id) => id !== 3).map(key)).toEqual(["p1", "p3", "p4", "t14", "t12", "p2", "t10", "t11"]);
  });
});

describe("topLevel", () => {
  it("tira os itens que já vão junto com uma pasta da lista", () => {
    const items = [
      { kind: "snippet" as const, id: 13 },
      { kind: "folder" as const, id: 3 },
      { kind: "folder" as const, id: 1 },
      { kind: "snippet" as const, id: 10 },
    ];
    expect(topLevel(items, folders, snippets)).toEqual([
      { kind: "folder", id: 1 },
      { kind: "snippet", id: 10 },
    ]);
  });
});
