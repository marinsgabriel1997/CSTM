import { expect, test } from "../support/fixtures";
import { invocar } from "../support/biblioteca";
import { abrirPagina, desmarcar, grupo, marcar } from "../support/paginas";

// Cada opção muda na tela, vale na hora (conferida pelo comando do app) e fica lembrada depois de reiniciar.
// Ficam de fora, de propósito: "Iniciar com o Windows" (grava no registro) e "Verificar agora" (rede).

test.beforeEach(async ({ main }) => {
  await abrirPagina(main, "Configurações");
  await expect(main.getByRole("textbox", { name: "Atalho" })).toBeVisible();
});

test.describe("atalho do menu", () => {
  test("troca o atalho, mostra o estado e lembra depois de reiniciar", async ({ app, main }) => {
    const campo = main.getByRole("textbox", { name: "Atalho" });
    await expect(campo).toContainText("Alt");
    await expect(campo).toContainText("Q");
    await expect(main.getByRole("button", { name: /Restaurar padrão \(Alt\+Q\)/ })).toBeDisabled();

    await main.getByRole("button", { name: "Alterar" }).click();
    await expect(main.getByRole("button", { name: "Cancelar" })).toBeVisible();
    await expect(campo).toBeFocused();
    await main.keyboard.press("Control+Alt+Shift+F9");

    await expect(main.getByText("Atalho alterado.")).toBeVisible();
    await expect(campo).toContainText("Ctrl");
    await expect(campo).toContainText("Shift");
    await expect(campo).toContainText("F9");
    await expect(main.getByText(/Atalhos com Ctrl\+Alt podem bloquear/)).toBeVisible();
    await expect(main.getByRole("button", { name: /Restaurar padrão/ })).toBeEnabled();
    expect(await invocar(main, "get_shortcut")).toEqual({ shortcut: "Ctrl+Alt+Shift+F9", registered: true });

    await app.reiniciar();
    const depois = await app.main();
    await abrirPagina(depois, "Configurações");
    const campoDepois = depois.getByRole("textbox", { name: "Atalho" });
    await expect(campoDepois).toContainText("F9");
    await expect(campoDepois).toContainText("Shift");
    expect(await invocar(depois, "get_shortcut")).toEqual({ shortcut: "Ctrl+Alt+Shift+F9", registered: true });
  });

  test("Cancelar e Esc mantêm o atalho; combinação inválida avisa e segue gravando", async ({ main }) => {
    const campo = main.getByRole("textbox", { name: "Atalho" });
    await main.getByRole("button", { name: "Alterar" }).click();
    await main.keyboard.press("Escape");
    await expect(main.getByRole("button", { name: "Alterar" })).toBeVisible();
    await expect(campo).toContainText("Q");

    await main.getByRole("button", { name: "Alterar" }).click();
    // Sem Ctrl nem Alt não vale.
    await main.keyboard.press("F9");
    await expect(main.getByText(/Use Ctrl ou Alt/)).toBeVisible();
    await main.getByRole("button", { name: "Cancelar" }).click();
    await expect(main.getByRole("button", { name: "Alterar" })).toBeVisible();
    expect(await invocar<{ shortcut: string }>(main, "get_shortcut")).toMatchObject({ shortcut: "Alt+KeyQ" });
  });
});

test("navegação nas pastas: muda e fica lembrada", async ({ app, main }) => {
  const opcoes = grupo(main, "Navegação nas pastas");
  await expect(opcoes.getByRole("radio", { name: /Abrir ao passar o mouse/ })).toBeChecked();
  await marcar(opcoes.getByRole("radio", { name: /Clicar para abrir/ }));
  await expect(opcoes.getByRole("radio", { name: /Clicar para abrir/ })).toBeChecked();
  expect(await invocar(main, "get_picker_navigation")).toBe("click");

  await app.reiniciar();
  const depois = await app.main();
  await abrirPagina(depois, "Configurações");
  await expect(grupo(depois, "Navegação nas pastas").getByRole("radio", { name: /Clicar para abrir/ })).toBeChecked();
  expect(await invocar(depois, "get_picker_navigation")).toBe("click");

  await marcar(grupo(depois, "Navegação nas pastas").getByRole("radio", { name: /Abrir ao passar o mouse/ }));
  expect(await invocar(depois, "get_picker_navigation")).toBe("cascade");
});

test.describe("tema", () => {
  /** Fundo do tema do Fluent UI (variável do FluentProvider): claro #ffffff, escuro #292929. */
  const fundo = (pagina: import("@playwright/test").Page) =>
    pagina.evaluate(() => getComputedStyle(document.querySelector(".fui-FluentProvider")!).getPropertyValue("--colorNeutralBackground1").trim());
  const CLARO = "#ffffff";
  const ESCURO = "#292929";

  test("claro, escuro e seguir o Windows mudam a janela na hora e ficam lembrados", async ({ app, main }) => {
    const opcoes = grupo(main, "Tema");
    await expect(opcoes.getByRole("radio", { name: "Seguir o Windows" })).toBeChecked();
    const windowsEscuro = await main.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    await expect.poll(() => fundo(main)).toBe(windowsEscuro ? ESCURO : CLARO);

    await marcar(opcoes.getByRole("radio", { name: "Escuro" }));
    await expect.poll(() => fundo(main)).toBe(ESCURO);
    expect(await invocar(main, "get_theme")).toBe("dark");

    await marcar(opcoes.getByRole("radio", { name: "Claro" }));
    await expect.poll(() => fundo(main)).toBe(CLARO);
    expect(await invocar(main, "get_theme")).toBe("light");

    await marcar(opcoes.getByRole("radio", { name: "Escuro" }));
    await app.reiniciar();
    const depois = await app.main();
    await abrirPagina(depois, "Configurações");
    await expect(grupo(depois, "Tema").getByRole("radio", { name: "Escuro" })).toBeChecked();
    await expect.poll(() => fundo(depois)).toBe(ESCURO);

    await marcar(grupo(depois, "Tema").getByRole("radio", { name: "Seguir o Windows" }));
    await expect.poll(() => fundo(depois)).toBe(windowsEscuro ? ESCURO : CLARO);
    expect(await invocar(depois, "get_theme")).toBe("system");
  });

  test("o tema vale também no menu de colagem", async ({ app, main }) => {
    const picker = await app.picker();
    await marcar(grupo(main, "Tema").getByRole("radio", { name: "Escuro" }));
    await expect.poll(() => fundo(picker)).toBe(ESCURO);
    await marcar(grupo(main, "Tema").getByRole("radio", { name: "Claro" }));
    await expect.poll(() => fundo(picker)).toBe(CLARO);
  });
});

test("modo de colagem padrão: cada modo muda e fica lembrado", async ({ app, main }) => {
  const modos = [
    { nome: /Markdown/, valor: "markdown" },
    { nome: /Sem formatação/, valor: "plain" },
    { nome: /Formatado/, valor: "rich" },
    { nome: /Google Chat/, valor: "chat" },
  ];
  await expect(grupo(main, "Modo de colagem padrão").getByRole("radio", { name: modos[0].nome })).toBeChecked();
  let pagina = main;
  // Do último ao primeiro, para cada escolha mudar o que já estava gravado.
  for (const modo of [...modos].reverse()) {
    await marcar(grupo(pagina, "Modo de colagem padrão").getByRole("radio", { name: modo.nome }));
    expect(await invocar(pagina, "get_paste_format")).toBe(modo.valor);
    await app.reiniciar();
    pagina = await app.main();
    await abrirPagina(pagina, "Configurações");
    await expect(grupo(pagina, "Modo de colagem padrão").getByRole("radio", { name: modo.nome })).toBeChecked();
    expect(await invocar(pagina, "get_paste_format")).toBe(modo.valor);
  }
});

test("Depois de colar: manter ou restaurar, lembrado após reiniciar", async ({ app, main }) => {
  const opcoes = grupo(main, "Depois de colar");
  await expect(opcoes.getByRole("radio", { name: /Manter o que foi colado/ })).toBeChecked();
  await marcar(opcoes.getByRole("radio", { name: /Restaurar o conteúdo anterior/ }));
  expect(await invocar(main, "get_after_paste")).toBe("restore");

  await app.reiniciar();
  const depois = await app.main();
  await abrirPagina(depois, "Configurações");
  await expect(grupo(depois, "Depois de colar").getByRole("radio", { name: /Restaurar o conteúdo anterior/ })).toBeChecked();
  expect(await invocar(depois, "get_after_paste")).toBe("restore");

  await marcar(grupo(depois, "Depois de colar").getByRole("radio", { name: /Manter o que foi colado/ }));
  expect(await invocar(depois, "get_after_paste")).toBe("keep");
});

test("histórico: liga e desliga e fica lembrado; Limpar fica desabilitado sem itens", async ({ app, main }) => {
  const opcao = main.getByRole("switch", { name: "Guardar o histórico da área de transferência" });
  await expect(opcao).toBeChecked();
  await desmarcar(opcao);
  await expect(opcao).not.toBeChecked();
  expect(await invocar(main, "get_clipboard_monitoring")).toBe(false);
  // Com o histórico desligado nada novo entra; sem itens, não há o que limpar.
  await expect(main.getByRole("button", { name: "Limpar histórico" })).toBeDisabled();

  await app.reiniciar();
  const depois = await app.main();
  await abrirPagina(depois, "Configurações");
  const opcaoDepois = depois.getByRole("switch", { name: "Guardar o histórico da área de transferência" });
  await expect(opcaoDepois).not.toBeChecked();
  expect(await invocar(depois, "get_clipboard_monitoring")).toBe(false);

  await marcar(opcaoDepois);
  await expect(opcaoDepois).toBeChecked();
  expect(await invocar(depois, "get_clipboard_monitoring")).toBe(true);
  // Desliga de novo: o teste não deixa o app lendo o clipboard do usuário à toa.
  await desmarcar(opcaoDepois);
});

test.describe("atualizações", () => {
  // O suporte desliga a verificação ao abrir. O app só consulta o GitHub 10 s depois de abrir, então a
  // opção só é ligada depois dessa marca; e "Verificar agora" nunca é clicado.
  test("o intervalo respeita os limites de 1 a 90 dias e a opção fica lembrada", async ({ app, main }) => {
    const ligar = main.getByRole("switch", { name: "Verificar atualizações" });
    const intervalo = main.getByRole("spinbutton", { name: "Intervalo em dias" });
    await expect(ligar).not.toBeChecked();
    await expect(intervalo).toBeDisabled();
    await expect(intervalo).toHaveValue("7");

    await app.esperarPassarDaPrimeiraVerificacao();
    await marcar(ligar);
    await expect(ligar).toBeChecked();
    await expect(intervalo).toBeEnabled();
    expect(await invocar(main, "get_update_settings")).toEqual({ enabled: true, intervalDays: 7 });

    const gravado = () => invocar<{ enabled: boolean; intervalDays: number }>(main, "get_update_settings").then((c) => c.intervalDays);
    await intervalo.fill("30");
    await intervalo.press("Enter");
    await expect.poll(gravado).toBe(30);

    await intervalo.fill("0");
    await intervalo.press("Enter");
    await expect.poll(gravado).toBe(1);
    await expect(intervalo).toHaveValue("1");

    await intervalo.fill("500");
    await intervalo.press("Enter");
    await expect.poll(gravado).toBe(90);
    await expect(intervalo).toHaveValue("90");

    await intervalo.fill("45");
    await intervalo.press("Enter");
    await expect.poll(gravado).toBe(45);

    // Reiniciar: o app abre com a verificação ligada e 45 dias (o suporte a desliga em seguida, bem antes dos 10 s).
    await app.reiniciar();
    expect(app.atualizacoesAoAbrir).toEqual({ enabled: true, intervalDays: 45 });
    const depois = await app.main();
    await abrirPagina(depois, "Configurações");
    await expect(depois.getByRole("switch", { name: "Verificar atualizações" })).not.toBeChecked();
    await expect(depois.getByRole("spinbutton", { name: "Intervalo em dias" })).toHaveValue("45");
  });

  test("desligar a verificação trava o campo do intervalo", async ({ app, main }) => {
    await app.esperarPassarDaPrimeiraVerificacao();
    const ligar = main.getByRole("switch", { name: "Verificar atualizações" });
    await marcar(ligar);
    await expect(main.getByRole("spinbutton", { name: "Intervalo em dias" })).toBeEnabled();
    await desmarcar(ligar);
    await expect(main.getByRole("spinbutton", { name: "Intervalo em dias" })).toBeDisabled();
    expect(await invocar<{ enabled: boolean }>(main, "get_update_settings")).toMatchObject({ enabled: false });
  });
});
