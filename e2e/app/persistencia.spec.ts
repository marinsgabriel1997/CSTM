import { expect, test } from "../support/fixtures";
import { arvore, esperarLinhas, invocar, pastasDoBanco, semear, textosDoBanco } from "../support/biblioteca";
import { fecharJanelaPeloSistema, posicionarJanela } from "../support/janela";
import type { AppDeTeste } from "../support/app";
import type { Page } from "@playwright/test";

interface Geometria {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Posição e tamanho interno da janela main (pixels físicos), lidos do próprio app. */
async function geometria(main: Page): Promise<Geometria> {
  const posicao = await invocar<{ x: number; y: number }>(main, "plugin:window|outer_position", { label: "main" });
  const tamanho = await invocar<{ width: number; height: number }>(main, "plugin:window|inner_size", { label: "main" });
  return { x: posicao.x, y: posicao.y, largura: tamanho.width, altura: tamanho.height };
}

/** O app grava o tamanho em pixels lógicos arredondados, então a volta pode diferir em 1 ou 2 px. */
function esperarGeometriaIgual(atual: Geometria, esperada: Geometria): void {
  expect(atual.x).toBe(esperada.x);
  expect(atual.y).toBe(esperada.y);
  expect(Math.abs(atual.largura - esperada.largura)).toBeLessThanOrEqual(2);
  expect(Math.abs(atual.altura - esperada.altura)).toBeLessThanOrEqual(2);
}

/** Muda a janela pelo Windows para algo diferente do padrão e devolve o que o app passou a ver. */
async function moverJanela(app: AppDeTeste, main: Page): Promise<Geometria> {
  const inicial = await geometria(main);
  posicionarJanela(app.pid, 220, 160, 1300, 900);
  await expect.poll(async () => (await geometria(main)).x).toBe(220);
  const nova = await geometria(main);
  expect(nova.largura).not.toBe(inicial.largura);
  return nova;
}

test.describe("dados", () => {
  test("fechar e reabrir mantém textos, pastas, favoritos e a ordem", async ({ app, main }) => {
    const ids = await semear(main, {
      pastas: {
        Trabalho: { Assinatura: "Att., Gabriel", Resposta: "Obrigado!", "Bom dia": "Bom dia a todos" },
        Pessoal: { Endereço: "Rua A, 10" },
      },
      raiz: { Telefone: "1234", Zeta: "z" },
    });
    // Ordem diferente da de criação e da alfabética.
    await invocar(main, "arrange_items", {
      parentId: ids.Trabalho,
      folderIds: [],
      snippetIds: [ids.Resposta, ids["Bom dia"], ids.Assinatura],
    });
    await invocar(main, "arrange_items", { parentId: null, folderIds: [ids.Pessoal, ids.Trabalho], snippetIds: [ids.Zeta, ids.Telefone] });
    await invocar(main, "set_favorite", { id: ids.Assinatura, favorite: true });
    await invocar(main, "set_favorite", { id: ids.Telefone, favorite: true });
    await main.reload();
    await arvore(main).waitFor();

    const antes = {
      textos: await textosDoBanco(main),
      pastas: await pastasDoBanco(main),
      favoritos: await invocar(main, "list_favorites"),
    };
    expect(antes.textos).toHaveLength(6);
    expect(antes.favoritos).toHaveLength(2);

    await app.reiniciar();
    const depois = await app.main();
    await arvore(depois).waitFor();
    expect(await textosDoBanco(depois)).toEqual(antes.textos);
    expect(await pastasDoBanco(depois)).toEqual(antes.pastas);
    expect(await invocar(depois, "list_favorites")).toEqual(antes.favoritos);

    // A árvore mostra a mesma ordem: pastas na ordem escolhida, depois os textos da raiz.
    await esperarLinhas(depois, ["Pessoal", "  Endereço", "Trabalho", "  Resposta", "  Bom dia", "  Assinatura", "Zeta", "Telefone"]);
  });

  test("o que foi apagado e o que está na lixeira também voltam como estavam", async ({ app, main }) => {
    const ids = await semear(main, { raiz: { Fica: "1", Lixo: "2" } });
    await invocar(main, "trash_items", { items: [{ kind: "snippet", id: ids.Lixo }] });
    await app.reiniciar();
    const depois = await app.main();
    await arvore(depois).waitFor();
    expect((await textosDoBanco(depois)).map((t) => t.title)).toEqual(["Fica"]);
    expect((await invocar<{ name: string }[]>(depois, "list_trash")).map((i) => i.name)).toEqual(["Lixo"]);
  });
});

test.describe("janela principal", () => {
  test("tamanho e posição ficam lembrados depois de reiniciar", async ({ app, main }) => {
    const nova = await moverJanela(app, main);
    await app.reiniciar();
    esperarGeometriaIgual(await geometria(await app.main()), nova);
  });

  test("tamanho e posição ficam gravados ao fechar a janela, mesmo sem sair pelo menu", async ({ app, main }) => {
    const nova = await moverJanela(app, main);
    fecharJanelaPeloSistema(app.pid);
    await expect.poll(() => invocar(main, "plugin:window|is_visible", { label: "main" })).toBe(false);
    // Derruba o processo sem passar por "Sair": só vale o que o fechamento da janela já gravou.
    await app.encerrar();
    await app.iniciar(false);
    esperarGeometriaIgual(await geometria(await app.main()), nova);
  });

  test("fechar a janela só a oculta: o app continua rodando e a janela volta", async ({ app, main }) => {
    await semear(main, { raiz: { Rascunho: "texto" } });
    await main.getByRole("treeitem", { name: "Rascunho", exact: true }).click();
    await expect(main.getByRole("textbox", { name: "Título" })).toHaveValue("Rascunho");

    fecharJanelaPeloSistema(app.pid);
    await expect.poll(() => invocar(main, "plugin:window|is_visible", { label: "main" })).toBe(false);
    // Passa um tempo para um encerramento tardio aparecer.
    await main.waitForTimeout(1000);
    expect(app.vivo()).toBe(true);
    expect(main.isClosed()).toBe(false);
    expect(await invocar(main, "list_folders")).toEqual([]);

    // O mesmo que o clique na bandeja ou abrir o app de novo: a janela volta como estava.
    await invocar(main, "show_main_window");
    await expect.poll(() => invocar(main, "plugin:window|is_visible", { label: "main" })).toBe(true);
    await expect(main.getByRole("textbox", { name: "Título" })).toHaveValue("Rascunho");
  });
});
