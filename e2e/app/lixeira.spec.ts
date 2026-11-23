import { expect, test } from "../support/fixtures";
import { arvore, esperarLinhas, linha, pastasDoBanco, semear, textosDoBanco } from "../support/biblioteca";

const SEMENTE = {
  pastas: {
    Trabalho: { Assinatura: "Att.", Resposta: "Olá!" },
    Pessoal: { Endereço: "Rua A, 1" },
  },
  raiz: { Telefone: "1234", Agenda: "https://agenda" },
};
const SEMEADO = ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Telefone", "Agenda"];

test("Delete manda à Lixeira sem confirmação e Desfazer na notificação devolve ao mesmo lugar", async ({ main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Assinatura").click();
  await arvore(main).focus();
  await main.keyboard.press("Delete");
  await expect(main.getByRole("alertdialog")).toHaveCount(0);
  await esperarLinhas(main, ["Trabalho", "  Resposta", "Pessoal", "  Endereço", "Telefone", "Agenda"]);
  const aviso = main.getByRole("listitem").filter({ hasText: "1 item movido para a lixeira." });
  await expect(aviso).toBeVisible();
  await expect(main.getByRole("button", { name: "Lixeira, 1 item" })).toBeVisible();

  await aviso.getByRole("button", { name: "Desfazer" }).click();
  await esperarLinhas(main, SEMEADO);
  await expect(main.getByRole("button", { name: "Lixeira, 0 itens" })).toBeVisible();
});

test("Ctrl+Z depois de Delete devolve o item", async ({ main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Telefone").click();
  await arvore(main).focus();
  await main.keyboard.press("Delete");
  await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Pessoal", "  Endereço", "Agenda"]);
  await arvore(main).focus();
  await main.keyboard.press("Control+z");
  await esperarLinhas(main, SEMEADO);
});

test("Shift+Delete pede confirmação, Cancelar mantém tudo e Excluir definitivamente apaga sem passar pela Lixeira", async ({
  main,
}) => {
  await semear(main, SEMENTE);
  await linha(main, "Trabalho").click();
  await arvore(main).focus();
  await main.keyboard.press("Shift+Delete");
  let dialogo = main.getByRole("alertdialog");
  await expect(dialogo.getByText("Excluir definitivamente a pasta “Trabalho”?")).toBeVisible();
  await expect(dialogo.getByText("2 textos", { exact: true })).toBeVisible();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toHaveCount(0);
  await esperarLinhas(main, SEMEADO);

  await arvore(main).focus();
  await main.keyboard.press("Shift+Delete");
  dialogo = main.getByRole("alertdialog");
  await dialogo.getByRole("button", { name: "Excluir definitivamente" }).click();
  await esperarLinhas(main, ["Pessoal", "  Endereço", "Telefone", "Agenda"]);
  await expect(main.getByRole("button", { name: "Lixeira, 0 itens" })).toBeVisible();
  expect((await pastasDoBanco(main)).map((p) => p.name)).toEqual(["Pessoal"]);
  expect((await textosDoBanco(main)).map((t) => t.title).sort()).toEqual(["Agenda", "Endereço", "Telefone"]);
});

test("a Lixeira lista o que saiu, Restaurar volta ao lugar, Excluir definitivamente e Esvaziar lixeira", async ({ main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Telefone").click();
  await linha(main, "Agenda").click({ modifiers: ["Control"] });
  await linha(main, "Pessoal").click({ modifiers: ["Control"] });
  await arvore(main).focus();
  await main.keyboard.press("Delete");
  await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta"]);

  await main.getByRole("button", { name: "Lixeira, 3 itens" }).click();
  const painel = main.getByRole("region", { name: "Lixeira" });
  const itens = painel.getByRole("listbox", { name: "Itens na lixeira" });
  await expect(itens.getByRole("option")).toHaveText([/Pessoal/, /Telefone/, /Agenda/]);
  await expect(itens.getByText("Pasta com 1 texto")).toBeVisible();

  await itens.getByRole("option", { name: "Telefone" }).click();
  await itens.getByRole("button", { name: "Restaurar “Telefone”" }).click();
  await esperarLinhas(main, ["Trabalho", "  Assinatura", "  Resposta", "Telefone"]);
  await expect(main.getByRole("button", { name: "Lixeira, 2 itens" })).toBeVisible();

  await itens.getByRole("option", { name: "Agenda" }).click();
  await painel.getByRole("button", { name: "Excluir definitivamente", exact: true }).click();
  let dialogo = main.getByRole("alertdialog");
  await expect(dialogo.getByText("Excluir definitivamente “Agenda”?")).toBeVisible();
  await dialogo.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(dialogo).toHaveCount(0);
  await expect.poll(async () => (await textosDoBanco(main)).map((t) => t.title)).not.toContain("Agenda");

  await painel.getByRole("button", { name: "Esvaziar lixeira" }).click();
  dialogo = main.getByRole("alertdialog");
  await expect(
    dialogo.getByText("O item da lixeira será excluído definitivamente, incluindo 1 pasta com 1 texto. Esta ação não pode ser desfeita."),
  ).toBeVisible();
  await dialogo.getByRole("button", { name: "Esvaziar lixeira" }).click();
  await expect(painel.getByText("A lixeira está vazia.")).toBeVisible();
  expect((await pastasDoBanco(main)).map((p) => p.name)).toEqual(["Trabalho"]);
  expect((await textosDoBanco(main)).map((t) => t.title).sort()).toEqual(["Assinatura", "Resposta", "Telefone"]);
});

test("restaurar uma pasta traz o conteúdo junto", async ({ main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Trabalho").click();
  await arvore(main).focus();
  await main.keyboard.press("Delete");
  await esperarLinhas(main, ["Pessoal", "  Endereço", "Telefone", "Agenda"]);
  await main.getByRole("button", { name: "Lixeira, 1 item" }).click();
  await main.getByRole("listbox", { name: "Itens na lixeira" }).getByRole("option", { name: "Trabalho" }).click();
  await main.getByRole("button", { name: "Restaurar “Trabalho”" }).click();
  await main.getByRole("tree", { name: "Biblioteca" }).waitFor();
  await esperarLinhas(main, ["Pessoal", "  Endereço", "Trabalho", "  Assinatura", "  Resposta", "Telefone", "Agenda"]);
});

test("soltar um item sobre a Lixeira o envia para ela", async ({ main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Trabalho").dragTo(main.getByRole("button", { name: "Lixeira, 0 itens" }));
  await esperarLinhas(main, ["Pessoal", "  Endereço", "Telefone", "Agenda"]);
  await expect(main.getByRole("button", { name: "Lixeira, 1 item" })).toBeVisible();
});

test("a Lixeira continua com os itens depois de reiniciar o app", async ({ app, main }) => {
  await semear(main, SEMENTE);
  await linha(main, "Telefone").click();
  await arvore(main).focus();
  await main.keyboard.press("Delete");
  await expect(main.getByRole("button", { name: "Lixeira, 1 item" })).toBeVisible();
  await app.reiniciar();
  const nova = await app.main();
  await expect(nova.getByRole("button", { name: "Lixeira, 1 item" })).toBeVisible();
});
