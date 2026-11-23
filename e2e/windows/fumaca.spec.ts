import { invocar } from "../support/biblioteca";
import { ENSAIO } from "../support/windows/ensaio";
import { esperarMenuAberto } from "../support/windows/menu";
import { expect, passo, test } from "./fixtures";

// Em ensaio (CSTM_E2E_ENSAIO=1) os testes do Windows não rodam; todo spec desta pasta repete este skip.
test.skip(ENSAIO, "ensaio: só o setup roda");

test("Alt+Q abre o menu e o texto é colado na janela alvo", async ({ helper, app, main, alvo }) => {
  const titulo = "Fumaca E2E";
  const conteudo = "Olá da fumaça: açaí e coração";

  await passo("cadastrar o texto pelo comando create_snippet", async () => {
    await invocar(main, "create_snippet", { folderId: null, title: titulo, content: conteudo });
    // Sem o histórico ligado, o que o teste escreve no clipboard não entra na lista do menu.
    await invocar(main, "set_clipboard_monitoring", { enabled: false });
  });

  await passo("focar a janela alvo", async () => {
    await helper.alvoLimpar();
    expect(await helper.alvoFocar(), "a janela alvo não ficou em primeiro plano").toBe(true);
  });

  await passo("Alt+Q com o cursor sobre a janela alvo", async () => {
    const { caixa } = await helper.alvoPosicao();
    await helper.mouseMover(caixa.x + Math.round(caixa.largura / 2), caixa.y + Math.round(caixa.altura / 2));
    expect(await helper.esperarModificadoresSoltos(), "um modificador continua apertado").toBe(true);
    await helper.tecla("Alt+Q");
  });

  const picker = await passo("esperar o menu de colagem aberto", () => esperarMenuAberto({ helper, app }));

  await passo("digitar o título na busca com o teclado real", async () => {
    await helper.digitar(titulo);
    await expect(picker.getByRole("listbox", { name: "Textos" }).getByRole("option").filter({ hasText: titulo })).toBeVisible();
  });

  await passo("Enter cola o texto na janela alvo", async () => {
    await helper.tecla("Enter");
    await expect.poll(() => helper.alvoLer(), { timeout: 10_000, message: "o texto não chegou à janela alvo" }).toBe(conteudo);
  });

  await passo("o app de teste segue vivo", async () => {
    expect(app.vivo()).toBe(true);
    expect(alvo.titulo).toContain("alvo");
  });
});
