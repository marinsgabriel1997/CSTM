import { expect, type Locator, type Page } from "@playwright/test";

type Invocador = (comando: string, args?: object) => Promise<unknown>;

/** Chama um comando do app pela página (o mesmo caminho do frontend, sem interface). */
export function invocar<T = unknown>(pagina: Page, comando: string, args: object = {}): Promise<T> {
  return pagina.evaluate(
    ([c, a]) => (window as unknown as { __TAURI_INTERNALS__: { invoke: Invocador } }).__TAURI_INTERNALS__.invoke(c as string, a as object),
    [comando, args] as const,
  ) as Promise<T>;
}

export interface Semente {
  /** Pastas na raiz, com seus textos: { Trabalho: { Assinatura: "Att." } }. */
  pastas?: Record<string, Record<string, string>>;
  /** Textos na raiz. */
  raiz?: Record<string, string>;
}

/** Cadastra os dados direto pelos comandos e recarrega a página para a árvore mostrá-los. */
export async function semear(pagina: Page, semente: Semente): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};
  for (const [pasta, textos] of Object.entries(semente.pastas ?? {})) {
    const criada = await invocar<{ id: number }>(pagina, "create_folder", { parentId: null, name: pasta });
    ids[pasta] = criada.id;
    for (const [titulo, conteudo] of Object.entries(textos)) {
      const texto = await invocar<{ id: number }>(pagina, "create_snippet", { folderId: criada.id, title: titulo, content: conteudo });
      ids[titulo] = texto.id;
    }
  }
  for (const [titulo, conteudo] of Object.entries(semente.raiz ?? {})) {
    const texto = await invocar<{ id: number }>(pagina, "create_snippet", { folderId: null, title: titulo, content: conteudo });
    ids[titulo] = texto.id;
  }
  await pagina.reload();
  await arvore(pagina).waitFor();
  return ids;
}

export function arvore(pagina: Page): Locator {
  return pagina.getByRole("tree", { name: "Biblioteca" });
}

export function linha(pagina: Page, nome: string): Locator {
  return arvore(pagina).getByRole("treeitem", { name: nome, exact: true });
}

/** Nomes das linhas da árvore, na ordem da tela, com a indentação como prefixo (a pasta Raiz fica de fora). */
export async function linhas(pagina: Page): Promise<string[]> {
  return arvore(pagina).getByRole("treeitem").evaluateAll((itens) => {
    const nivel = (el: Element) => Number(el.getAttribute("aria-level"));
    const raiz = itens.findIndex((el) => el.getAttribute("aria-label") === "Raiz" && nivel(el) === 1);
    return itens
      .filter((_, i) => i !== raiz)
      .map((el, i) => {
        const n = nivel(el) - (itens.indexOf(el) > raiz ? 1 : 0);
        void i;
        return "  ".repeat(n - 1) + el.getAttribute("aria-label");
      });
  });
}

/** Espera a árvore ficar exatamente como `esperado`. */
export async function esperarLinhas(pagina: Page, esperado: string[]): Promise<void> {
  await expect.poll(() => linhas(pagina)).toEqual(esperado);
}

/** Linhas selecionadas (aria-selected). */
export async function selecionadas(pagina: Page): Promise<string[]> {
  return arvore(pagina)
    .getByRole("treeitem")
    .evaluateAll((itens) => itens.filter((el) => el.getAttribute("aria-selected") === "true").map((el) => el.getAttribute("aria-label") ?? ""));
}

export function estado(pagina: Page): Locator {
  return pagina.getByRole("status", { name: "Estado do salvamento" });
}

/** Espera a gravação automática terminar. */
export async function esperarSalvo(pagina: Page): Promise<void> {
  await expect(estado(pagina)).toContainText("Todas as alterações salvas", { timeout: 5000 });
}

/** Botão Novo > Novo texto / Nova pasta. */
export async function novo(pagina: Page, opcao: "Novo texto" | "Nova pasta"): Promise<void> {
  await pagina.getByRole("button", { name: "Novo", exact: true }).click();
  await pagina.getByRole("menuitem", { name: new RegExp(opcao) }).click();
}

/** Textos e pastas do banco, lidos pelos comandos (só leitura, para conferir a gravação). */
export async function textosDoBanco(pagina: Page) {
  return invocar<{ id: number; folderId: number | null; title: string; content: string; favorite: boolean; useCount: number }[]>(
    pagina,
    "list_all_snippets",
  );
}

export async function pastasDoBanco(pagina: Page) {
  return invocar<{ id: number; parentId: number | null; name: string }[]>(pagina, "list_folders");
}

export async function menuDeContexto(pagina: Page, nome: string): Promise<Locator> {
  await linha(pagina, nome).click({ button: "right" });
  const menu = pagina.getByRole("menu");
  await menu.waitFor();
  return menu;
}
