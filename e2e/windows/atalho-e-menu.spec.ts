import { invocar, semear } from "../support/biblioteca";
import {
  abrirMenu,
  centro,
  centroDoAlvo,
  desligarHistorico,
  esperarMenuFechado,
  garantirAlvoVazio,
  garantirPor,
  janelaDoMenu,
  retanguloNaTela,
} from "../support/windows/cenario";
import { ENSAIO } from "../support/windows/ensaio";
import { linhasDoMenu } from "../support/picker";
import { expect, passo, test } from "./fixtures";

// Alt+Q REAL abre o menu junto ao cursor; Esc e clique fora fecham sem colar; cascata e "Clicar para abrir" com o mouse e o teclado reais.
test.skip(ENSAIO, "ensaio: só o setup roda");

const BIBLIOTECA = {
  pastas: {
    Trabalho: { Assinatura: "Att., Gabriel", Resposta: "Obrigado pelo contato." },
    Pessoal: { Endereço: "Rua A, 10" },
    Vazia: {},
  },
  raiz: { Telefone: "1234" },
};

/** Tolerância (px físicos) entre a posição pedida e a medida na tela: arredondamentos da escala fracionária. */
const TOLERANCIA = 4;

test.beforeEach(async ({ main }) => {
  await semear(main, BIBLIOTECA);
  await desligarHistorico(main);
});

test("Alt+Q abre o menu junto ao cursor, dentro da área útil; Esc fecha sem colar", async ({ ctx }) => {
  const { helper } = ctx;
  const mouse = await centroDoAlvo(helper);
  const picker = await passo("Alt+Q com o cursor no centro da janela alvo", () => abrirMenu(ctx, { mouse }));

  await passo("a coluna principal começa no cursor e está dentro da área útil", async () => {
    const cartao = picker.locator("#picker-column-0");
    // Espera o aviso de abertura posicionar o cartão (antes disso ele ocupa a janela inteira).
    await expect.poll(async () => (await cartao.boundingBox())?.width ?? 0).toBeLessThan(600);
    const retangulo = await retanguloNaTela(ctx, picker, cartao);
    const janela = await janelaDoMenu(ctx);
    expect(Math.abs(retangulo.x - mouse.x), `x do menu ${retangulo.x} x cursor ${mouse.x}`).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(retangulo.y - mouse.y), `y do menu ${retangulo.y} x cursor ${mouse.y}`).toBeLessThanOrEqual(TOLERANCIA);
    const area = janela.retangulo;
    expect(retangulo.x).toBeGreaterThanOrEqual(area.x - TOLERANCIA);
    expect(retangulo.y).toBeGreaterThanOrEqual(area.y - TOLERANCIA);
    expect(retangulo.x + retangulo.largura).toBeLessThanOrEqual(area.x + area.largura + TOLERANCIA);
    expect(retangulo.y + retangulo.altura).toBeLessThanOrEqual(area.y + area.altura + TOLERANCIA);
    await expect(picker.getByRole("listbox", { name: "Textos" }).getByRole("option")).toHaveCount(4);
  });

  await passo("Esc fecha o menu e nada é colado", async () => {
    await helper.tecla("Esc");
    await esperarMenuFechado(ctx);
    await garantirAlvoVazio(helper);
  });
});

test("perto das bordas direita e inferior o menu abre para a esquerda e para cima do cursor", async ({ ctx }) => {
  const { helper } = ctx;
  const tela = await helper.telaInfo();
  // 60 px acima do fim cai dentro da área útil (a barra de tarefas fica abaixo); o menu não cabe à direita nem abaixo.
  const mouse = { x: tela.principal.largura - 60, y: tela.principal.altura - 140 };
  const picker = await passo("Alt+Q com o cursor perto do canto inferior direito", () => abrirMenu(ctx, { mouse }));
  await passo("o canto inferior direito do menu fica no cursor", async () => {
    const cartao = picker.locator("#picker-column-0");
    await expect.poll(async () => (await cartao.boundingBox())?.width ?? 0).toBeLessThan(600);
    const r = await retanguloNaTela(ctx, picker, cartao);
    expect(Math.abs(r.x + r.largura - mouse.x), `borda direita ${r.x + r.largura} x cursor ${mouse.x}`).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(r.y + r.altura - mouse.y), `borda inferior ${r.y + r.altura} x cursor ${mouse.y}`).toBeLessThanOrEqual(TOLERANCIA);
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
});

test("clique fora do menu o fecha sem colar", async ({ ctx }) => {
  const { helper } = ctx;
  await passo("abrir o menu", () => abrirMenu(ctx));
  await passo("clicar na janela alvo, longe do menu", async () => {
    const { caixa } = await helper.alvoPosicao();
    await helper.mouseClicar(caixa.x + 30, caixa.y + 30);
    await esperarMenuFechado(ctx);
  });
  await passo("o alvo não recebeu nada", () => garantirAlvoVazio(helper));
});

test("cascata: passar o mouse numa pasta abre a coluna ao lado e passar num texto a fecha", async ({ ctx }) => {
  const { helper } = ctx;
  const picker = await passo("abrir o menu (cascata é o padrão)", () => abrirMenu(ctx));
  const trabalho = picker.getByRole("option", { name: "Trabalho" });
  await passo("mouse real sobre a pasta Trabalho", async () => {
    await expect(trabalho).toBeVisible();
    const r = await retanguloNaTela(ctx, picker, trabalho);
    const c = centro(r);
    await helper.mouseMover(c.x - 15, c.y);
    await helper.mouseMover(c.x, c.y);
  });
  await passo("a coluna Trabalho aparece à direita da principal", async () => {
    const coluna = picker.getByRole("listbox", { name: "Trabalho" });
    await expect(coluna.getByRole("option")).toHaveCount(2);
    const principal = await retanguloNaTela(ctx, picker, picker.locator("#picker-column-0"));
    const lateral = await retanguloNaTela(ctx, picker, picker.locator("#picker-column-1"));
    expect(lateral.x, "a coluna aberta deve ficar ao lado da principal").toBeGreaterThanOrEqual(principal.x + principal.largura - TOLERANCIA);
  });
  await passo("mouse sobre o texto Telefone fecha a coluna", async () => {
    const telefone = picker.getByRole("option", { name: "Telefone" });
    const c = centro(await retanguloNaTela(ctx, picker, telefone));
    await helper.mouseMover(c.x - 10, c.y);
    await helper.mouseMover(c.x, c.y);
    await expect(picker.getByRole("listbox", { name: "Trabalho" })).toHaveCount(0);
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
});

test("cascata: → abre a coluna da pasta, ← fecha e volta à pasta de origem", async ({ ctx }) => {
  const { helper } = ctx;
  const picker = await passo("abrir o menu", () => abrirMenu(ctx));
  const busca = picker.getByRole("combobox", { name: "Buscar", exact: true });
  await passo("→ abre a coluna Trabalho e leva o teclado a ela", async () => {
    await expect(picker.getByRole("option", { name: "Trabalho" })).toHaveAttribute("aria-selected", "true");
    await helper.tecla("Right");
    await expect(picker.getByRole("listbox", { name: "Trabalho" }).getByRole("option")).toHaveCount(2);
    await expect(picker.getByRole("combobox", { name: "Buscar em Trabalho" })).toBeFocused();
  });
  await passo("↓ move dentro da coluna", async () => {
    const colunas = picker.getByRole("listbox", { name: "Trabalho" }).getByRole("option");
    await expect(colunas.first()).toHaveAttribute("aria-selected", "true");
    await helper.tecla("Down");
    await expect(colunas.nth(1)).toHaveAttribute("aria-selected", "true");
  });
  await passo("← fecha a coluna e volta a Trabalho na principal", async () => {
    await helper.tecla("Left");
    await expect(picker.getByRole("listbox", { name: "Trabalho" })).toHaveCount(0);
    await expect(busca).toBeFocused();
    await expect(picker.getByRole("option", { name: "Trabalho" })).toHaveAttribute("aria-selected", "true");
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
  await garantirAlvoVazio(helper, 500);
});

test("Clicar para abrir: o clique troca a lista pela pasta e ← volta", async ({ ctx, main }) => {
  const { helper } = ctx;
  await invocar(main, "set_picker_navigation", { navigation: "click" });
  const picker = await passo("abrir o menu no modo Clicar para abrir", () => abrirMenu(ctx));
  await passo("clique real na pasta Trabalho", async () => {
    const trabalho = picker.getByRole("option", { name: "Trabalho" });
    await expect(trabalho).toBeVisible();
    const c = centro(await retanguloNaTela(ctx, picker, trabalho));
    await helper.mouseClicar(c.x, c.y);
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Assinatura", "Resposta"]);
    await expect(picker.getByRole("button", { name: "Trabalho" })).toBeVisible();
  });
  await passo("← volta à lista inicial", async () => {
    await helper.tecla("Left");
    await expect.poll(() => linhasDoMenu(picker)).toEqual(["Trabalho", "Pessoal", "Vazia", "Telefone"]);
  });
  await passo("nenhuma coluna lateral existe nesse modo", async () => {
    await garantirPor(300, async () => (await picker.locator("#picker-column-1").count()) === 0, "uma coluna lateral apareceu");
  });
  await helper.tecla("Esc");
  await esperarMenuFechado(ctx);
});
