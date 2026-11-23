import { expect, type Page } from "@playwright/test";
import type { AppDeTeste } from "../app";
import type { HelperWindows } from "./helper";

/**
 * O menu de colagem é uma janela que o app MOSTRA e OCULTA (ela nunca é destruída), com a página picker sempre viva:
 * `document.hasFocus()` e o foco da busca continuam verdadeiros depois que a janela some. Por isso o estado aberto/fechado
 * vem do sistema: uma janela visível do processo do app com o tamanho da área útil (o menu ocupa o monitor e é recortado
 * em volta das colunas); a janela de cadastro é bem menor.
 */

interface Contexto {
  helper: HelperWindows;
  app: AppDeTeste;
}

export async function menuVisivel({ helper, app }: Contexto): Promise<boolean> {
  const [tela, janelas] = await Promise.all([helper.telaInfo(), helper.janelas({ pid: app.pid, soVisiveis: true })]);
  return janelas.some((j) => j.retangulo.largura >= tela.principal.largura * 0.9 && j.retangulo.altura >= tela.principal.altura * 0.85);
}

/** Espera o menu realmente aberto: janela visível no sistema, página com o foco e busca vazia e focada (estado da abertura). */
export async function esperarMenuAberto(ctx: Contexto, limiteMs = 10_000): Promise<Page> {
  await expect.poll(() => menuVisivel(ctx), { timeout: limiteMs, message: "a janela do menu de colagem não ficou visível" }).toBe(true);
  const picker = await ctx.app.picker();
  await expect.poll(() => picker.evaluate(() => document.hasFocus()), { timeout: limiteMs, message: "o menu de colagem não recebeu o foco do sistema" }).toBe(true);
  const busca = picker.getByRole("combobox", { name: "Buscar", exact: true });
  await expect(busca).toBeFocused({ timeout: limiteMs });
  // A abertura zera a busca; um valor antigo indica que o aviso de abertura ainda não foi tratado.
  await expect(busca).toHaveValue("", { timeout: limiteMs });
  return picker;
}

/** Espera o menu fechado: nenhuma janela visível do tamanho do menu. */
export async function esperarMenuFechado(ctx: Contexto, limiteMs = 10_000): Promise<void> {
  await expect.poll(() => menuVisivel(ctx), { timeout: limiteMs, message: "o menu de colagem continua aberto" }).toBe(false);
}
