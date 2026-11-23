import { invocar } from "../support/biblioteca";
import { abrirPagina } from "../support/paginas";
import { abrirMenu, desligarHistorico, esperarMenuFechado, focarAlvo, garantirPor, menuVisivel } from "../support/windows/cenario";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Trocar o atalho nas Configurações vale na hora: o novo abre o menu e o antigo (Alt+Q) deixa de abrir; voltar ao padrão restaura.
test.skip(ENSAIO, "ensaio: só o setup roda");

const NOVO = "Ctrl+Shift+F8";

test("o atalho novo vale na hora, o Alt+Q para de abrir e Restaurar padrão devolve o Alt+Q", async ({ ctx, main }) => {
  test.setTimeout(100_000);
  const { helper } = ctx;
  await desligarHistorico(main);
  await abrirPagina(main, "Configurações");
  const campo = main.getByRole("textbox", { name: "Atalho" });
  const menuAberto = () => menuVisivel(ctx);

  await passo("gravar Ctrl+Shift+F8 pela tela de Configurações", async () => {
    await main.getByRole("button", { name: "Alterar" }).click();
    await expect(campo).toBeFocused();
    // A tela de gravação lê eventos de teclado da página; a conferência do atalho global é toda real (abaixo).
    await main.keyboard.press("Control+Shift+F8");
    await expect(main.getByText("Atalho alterado.")).toBeVisible();
    expect(await invocar(main, "get_shortcut")).toEqual({ shortcut: "Ctrl+Shift+F8", registered: true });
  });

  await passo("o atalho novo abre o menu (teclado real)", async () => {
    const picker = await abrirMenu(ctx, { atalho: NOVO });
    await expect(picker.getByRole("combobox", { name: "Buscar" })).toBeFocused();
    await helper.tecla("Esc");
    await esperarMenuFechado(ctx);
  });

  await passo("o Alt+Q antigo não abre mais o menu", async () => {
    await focarAlvo(ctx);
    expect(await helper.esperarModificadoresSoltos()).toBe(true);
    await helper.tecla("Alt+Q");
    await garantirPor(1_500, async () => !(await menuAberto()), "o menu abriu com o atalho antigo");
  });

  await passo("Restaurar padrão (Alt+Q) volta ao atalho original", async () => {
    await main.getByRole("button", { name: /Restaurar padrão \(Alt\+Q\)/ }).click();
    await expect(main.getByText("Atalho alterado.")).toBeVisible();
    expect(await invocar(main, "get_shortcut")).toEqual({ shortcut: "Alt+KeyQ", registered: true });
  });

  await passo("o Alt+Q abre o menu de novo e o atalho de teste não abre mais", async () => {
    const picker = await abrirMenu(ctx);
    await expect(picker.getByRole("combobox", { name: "Buscar" })).toBeFocused();
    await helper.tecla("Esc");
    await esperarMenuFechado(ctx);
    await focarAlvo(ctx);
    await helper.tecla(NOVO);
    await garantirPor(1_500, async () => !(await menuAberto()), "o menu abriu com o atalho de teste depois de restaurar o padrão");
  });
});
