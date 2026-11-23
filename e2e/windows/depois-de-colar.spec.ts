import { semear, invocar } from "../support/biblioteca";
import { abrirMenu, desligarHistorico, escolherNoMenu, esperar, esperarAlvo, esperarClipboardTexto } from "../support/windows/cenario";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// "Depois de colar": manter o que foi colado ou restaurar o conteúdo anterior 500 ms depois do Ctrl+V.
test.skip(ENSAIO, "ensaio: só o setup roda");

const TEXTO = "Texto da nota";

test.beforeEach(async ({ main }) => {
  await semear(main, { raiz: { Nota: TEXTO } });
  await desligarHistorico(main);
});

test("Manter o que foi colado: o clipboard fica com o texto colado", async ({ ctx, main }) => {
  const { helper } = ctx;
  await invocar(main, "set_after_paste", { value: "keep" });
  await helper.clipEscrever({ texto: "conteúdo anterior" });
  await passo("colar a nota", () => escolherNoMenu(ctx, "Nota", { tipo: "enter" }));
  await esperarAlvo(helper, TEXTO);
  await passo("1,2 s depois (mais que os 500 ms da restauração) o clipboard ainda é o texto colado", async () => {
    await esperar(1_200);
    expect(await helper.clipTexto()).toBe(TEXTO);
  });
});

test.describe("Restaurar o conteúdo anterior", () => {
  test.beforeEach(async ({ main }) => {
    await invocar(main, "set_after_paste", { value: "restore" });
  });

  test("texto simples volta depois de colar", async ({ ctx }) => {
    const { helper } = ctx;
    await helper.clipEscrever({ texto: "conteúdo anterior" });
    const antes = await helper.clipResumo();
    await passo("colar a nota", () => escolherNoMenu(ctx, "Nota", { tipo: "enter" }));
    await passo("a colagem aconteceu", () => esperarAlvo(helper, TEXTO));
    await passo("o clipboard volta ao conteúdo anterior (em cerca de 500 ms)", async () => {
      await esperarClipboardTexto(helper, "conteúdo anterior", 5_000);
      const depois = await helper.clipResumo();
      expect(depois.hashes["CF_UNICODETEXT"], "o texto restaurado deve ser idêntico bit a bit").toBe(antes.hashes["CF_UNICODETEXT"]);
    });
  });

  test("texto com HTML volta com o HTML", async ({ ctx }) => {
    const { helper } = ctx;
    await helper.clipEscrever({ texto: "anterior rico", html: "<b>anterior</b> rico" });
    await passo("colar a nota", () => escolherNoMenu(ctx, "Nota", { tipo: "enter" }));
    await esperarAlvo(helper, TEXTO);
    await passo("texto e HTML anteriores voltaram", async () => {
      await esperarClipboardTexto(helper, "anterior rico", 5_000);
      await expect.poll(() => helper.clipHtmlFragmento(), { timeout: 5_000, message: "o HTML anterior não voltou" }).toBe("<b>anterior</b> rico");
    });
  });

  test("imagem volta depois de colar", async ({ ctx }) => {
    const { helper } = ctx;
    await helper.clipEscrever({ imagem: { largura: 40, altura: 30, cor: "#D23B2D" } });
    await passo("colar a nota (a imagem não é colada na caixa de texto)", () => escolherNoMenu(ctx, "Nota", { tipo: "enter" }));
    await esperarAlvo(helper, TEXTO);
    await passo("a imagem de 40 × 30 voltou e o texto colado saiu do clipboard", async () => {
      await expect
        .poll(async () => (await helper.clipResumo()).imagem, { timeout: 5_000, message: "a imagem anterior não voltou" })
        .toMatchObject({ largura: 40, altura: 30 });
      expect((await helper.clipResumo()).texto).toBeNull();
    });
  });

  test("se o clipboard mudar antes dos 500 ms, nada é restaurado", async ({ ctx }) => {
    const { helper } = ctx;
    await helper.clipEscrever({ texto: "conteúdo anterior" });
    await passo("colar a nota e, assim que o texto aparece, escrever outra coisa no clipboard", async () => {
      // Sem esperar o menu fechar (isso consumiria parte da janela de 500 ms): Enter e já vigia a caixa de texto.
      const picker = await abrirMenu(ctx);
      await helper.digitar("Nota");
      await expect(picker.getByRole("listbox", { name: "Textos" }).getByRole("option").filter({ hasText: "Nota" }).first()).toHaveAttribute("aria-selected", "true");
      await helper.tecla("Enter");
      // Laço apertado: a janela entre o Ctrl+V e a restauração é de 500 ms.
      const inicio = Date.now();
      while ((await helper.alvoLer()) !== TEXTO) {
        expect(Date.now() - inicio, "o texto não chegou à janela alvo").toBeLessThan(10_000);
        await esperar(15);
      }
      await helper.clipEscrever({ texto: "mudou depois" });
    });
    await passo("1,5 s depois o clipboard continua com o que foi escrito (não restaurou o anterior)", async () => {
      await esperar(1_500);
      expect(await helper.clipTexto(), "se voltou ao anterior, a escrita chegou depois dos 500 ms: repetir a rodada").toBe("mudou depois");
    });
  });
});
