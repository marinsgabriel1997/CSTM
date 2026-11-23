import { expect, type Locator, type Page } from "@playwright/test";

export type NomeDaPagina = "Ajuda" | "Configurações" | "Sobre o CSTM";

/** Linha de página no rodapé da árvore (botão com aria-pressed quando a página está aberta). */
export function linhaDaPagina(pagina: Page, nome: NomeDaPagina): Locator {
  return pagina.getByRole("button", { name: nome, exact: true });
}

/** Abre uma página (Ajuda, Configurações ou Sobre) pelo clique na linha do rodapé. */
export async function abrirPagina(pagina: Page, nome: NomeDaPagina): Promise<void> {
  const linha = linhaDaPagina(pagina, nome);
  if ((await linha.getAttribute("aria-pressed")) !== "true") await linha.click();
}

/** Grupo de opções (radio) das Configurações, pelo título dele. */
export function grupo(pagina: Page, nome: string): Locator {
  return pagina.getByRole("radiogroup", { name: nome });
}

/**
 * Marca um radio ou switch e espera a tela confirmar. Não usa `check()`: nas Configurações a opção só muda depois
 * da resposta do app, e o `check()` confere o estado logo depois do clique.
 */
export async function marcar(opcao: Locator): Promise<void> {
  await opcao.click();
  await expect(opcao).toBeChecked();
}

/** Desmarca um switch e espera a tela confirmar. */
export async function desmarcar(opcao: Locator): Promise<void> {
  await opcao.click();
  await expect(opcao).not.toBeChecked();
}
