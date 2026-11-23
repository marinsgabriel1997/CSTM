import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { arvore, linha, menuDeContexto, pastasDoBanco, semear, textosDoBanco } from "../support/biblioteca";
import type { Ctx } from "../support/windows/cenario";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Importar e exportar pelos diálogos nativos do Windows (preenchidos por UI Automation), em pastas temporárias criadas e apagadas aqui.
test.skip(ENSAIO, "ensaio: só o setup roda");

let raiz = "";

test.beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "cstm-e2e-"));
});

test.afterEach(() => {
  // Só apaga o que este teste criou: pasta cstm-e2e-* direto em os.tmpdir().
  if (raiz && basename(raiz).startsWith("cstm-e2e-") && dirname(raiz) === tmpdir()) rmSync(raiz, { recursive: true, force: true });
  raiz = "";
});

const BIBLIOTECA = {
  pastas: {
    Trabalho: { Assinatura: "Att., Gabriel", Resposta: "Obrigado pelo contato." },
    Pessoal: { Endereço: "Rua A, 10" },
    Destino: {},
  },
  raiz: { Telefone: "1234" },
};

function arquivo(caminho: string, conteudo: string | Buffer): string {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, conteudo);
  return caminho;
}

/** Mais opções > Importar/Exportar tudo > opção (os nomes são exatos: "Pasta…" também casaria com "Conteúdo de uma pasta…"). */
async function menuDeTransferencia(main: Page, grupo: "Importar" | "Exportar tudo", opcao: string): Promise<void> {
  await main.getByRole("button", { name: "Mais opções" }).click();
  await main.getByRole("menuitem", { name: grupo, exact: true }).click();
  await main.getByRole("menuitem", { name: opcao, exact: true }).click();
}

async function esperarDialogo({ helper, app }: Ctx): Promise<void> {
  const dialogo = await helper.dialogoEsperar(app.pid, 15_000);
  expect(dialogo, "o diálogo nativo não apareceu").not.toBeNull();
}

/** Qualquer falha com um diálogo aberto o fecha na hora (o helper também fecha os de erro): nunca deixa um modal para trás. */
async function comSeguranca({ helper, app }: Ctx, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
  } catch (erro) {
    await helper.dialogoFechar(app.pid).catch(() => undefined);
    throw erro;
  }
}

/** Seletor de PASTA ("Selecionar pasta"): vai até a pasta pela barra de endereço; o caminho nunca é digitado no campo de nome. */
const escolherPasta = (ctx: Ctx, pasta: string) =>
  comSeguranca(ctx, async () => {
    await esperarDialogo(ctx);
    const r = await ctx.helper.dialogoPasta(ctx.app.pid, pasta);
    expect(r.fechou, `o diálogo "${r.titulo}" não fechou`).toBe(true);
  });

/** Abrir vários arquivos: vai até a pasta pela barra de endereço, confere que está nela e escreve os nomes entre aspas no campo de nome. */
const escolherArquivos = (ctx: Ctx, pasta: string, nomes: string[]) =>
  comSeguranca(ctx, async () => {
    await esperarDialogo(ctx);
    await ctx.helper.dialogoNavegar(ctx.app.pid, pasta);
    // A lista de nomes entre aspas é o que o diálogo entende como seleção múltipla (colocada direto no campo Nome por Win32).
    const r = await ctx.helper.dialogoPreencher(ctx.app.pid, nomes.map((n) => `"${n}"`).join(" "), { pastaEsperada: pasta });
    expect(r.fechou, `o diálogo "${r.titulo}" não fechou`).toBe(true);
  });

/**
 * Abrir ou salvar UM arquivo. Nunca digita o caminho no campo de nome (o diálogo abre numa pasta real do usuário e um caminho
 * ali vira "Renomear" ou salva fora do teste): navega até a pasta temporária do teste pela barra de endereço, o helper confere
 * que o diálogo está nela e só então recebe o nome simples do arquivo. Fora da pasta do teste, o diálogo é cancelado e o teste falha.
 */
const escolherArquivo = (ctx: Ctx, caminho: string) =>
  comSeguranca(ctx, async () => {
    const pasta = dirname(caminho);
    const nome = basename(caminho);
    expect(caminho.startsWith(raiz) && basename(raiz).startsWith("cstm-e2e-"), `o arquivo do teste tem de ficar na pasta temporária do teste (${raiz}): ${caminho}`).toBe(true);
    expect(nome, "o campo Nome só recebe nome simples").not.toMatch(/[\\/:*?"<>|]/);
    await esperarDialogo(ctx);
    await ctx.helper.dialogoNavegar(ctx.app.pid, pasta);
    const r = await ctx.helper.dialogoPreencher(ctx.app.pid, nome, { pastaEsperada: pasta });
    expect(r.fechou, `o diálogo "${r.titulo}" não fechou`).toBe(true);
  });

/**
 * Aviso (toast ou lista de arquivos ignorados) visível. O Fluent repete o texto numa região aria-live invisível (`.fui-AriaLive`,
 * com o atributo aria-live), por isso ela fica de fora: só conta o elemento que o usuário vê.
 */
const avisoDe = (main: Page, texto: string | RegExp) => main.getByText(texto).and(main.locator(":not([aria-live])"));

/** Espera o aviso; se não vier, o erro leva o texto que a página mostrava (toast e avisos), para saber o que o app disse. */
async function esperarAviso(main: Page, texto: string | RegExp): Promise<void> {
  try {
    await expect(avisoDe(main, texto)).toBeVisible();
  } catch (erro) {
    const visivel = await main
      .locator("body")
      .innerText({ timeout: 2_000 })
      .catch(() => "(não foi possível ler a página)");
    throw new Error(`${String(erro instanceof Error ? erro.message : erro)}\n\nTexto visível na janela de cadastro:\n${visivel.slice(0, 1500)}`, { cause: erro });
  }
}

test("importar arquivos .txt: UTF-8 entra e o que não é UTF-8 é ignorado e informado", async ({ ctx, main }) => {
  const entrada = join(raiz, "entrada");
  arquivo(join(entrada, "Saudacao.txt"), "Olá, mundo! açaí");
  arquivo(join(entrada, "Despedida.txt"), "Até logo");
  arquivo(join(entrada, "Antigo.txt"), Buffer.from([0x4f, 0x6c, 0xe1])); // "Olá" em Latin-1, inválido em UTF-8
  await semear(main, {});

  await passo("Mais opções > Importar > Arquivos .txt…", () => menuDeTransferencia(main, "Importar", "Arquivos .txt…"));
  await passo("o diálogo: ir à pasta e escolher os três arquivos", async () => {
    await escolherArquivos(ctx, entrada, ["Saudacao.txt", "Despedida.txt", "Antigo.txt"]);
  });
  await passo("o aviso informa 2 textos e o arquivo ignorado", async () => {
    await esperarAviso(main, "2 textos importados na raiz.");
    await esperarAviso(main, "Antigo.txt: não está em UTF-8");
  });
  await passo("os textos estão no banco com acentos preservados", async () => {
    const textos = (await textosDoBanco(main)).map((t) => [t.title, t.content]).sort();
    expect(textos).toEqual([
      ["Despedida", "Até logo"],
      ["Saudacao", "Olá, mundo! açaí"],
    ]);
  });
});

test("importar uma pasta (com ela e só o conteúdo) lista os arquivos ignorados", async ({ ctx, main }) => {
  const pasta = join(raiz, "pasta");
  arquivo(join(pasta, "Clientes", "Nota A.txt"), "Texto A");
  arquivo(join(pasta, "Clientes", "Sub", "Nota B.txt"), "Texto B");
  arquivo(join(pasta, "ansi.txt"), Buffer.from([0x4f, 0x6c, 0xe1]));
  arquivo(join(pasta, "leia.md"), "# não é txt");
  arquivo(join(pasta, "vazio.txt"), "  \n ");
  await semear(main, { pastas: { Destino: {} } });

  await passo("Importar > Pasta… cria a própria pasta na raiz", async () => {
    await menuDeTransferencia(main, "Importar", "Pasta…");
    await escolherPasta(ctx, pasta);
    await esperarAviso(main, "2 textos e 3 pastas importados na raiz.");
    await esperarAviso(main, "ansi.txt: não está em UTF-8");
    await esperarAviso(main, "leia.md: não é um arquivo .txt");
    await esperarAviso(main, "vazio.txt: está vazio");
    expect((await pastasDoBanco(main)).map((p) => p.name).sort()).toEqual(["Clientes", "Destino", "Sub", "pasta"]);
  });

  await passo("Importar > Conteúdo de uma pasta… em Destino (selecionada) não cria a pasta escolhida", async () => {
    await linha(main, "Destino").click();
    await menuDeTransferencia(main, "Importar", "Conteúdo de uma pasta…");
    await escolherPasta(ctx, join(pasta, "Clientes"));
    await esperarAviso(main, "2 textos e 1 pasta importados em Destino.");
    const pastas = await pastasDoBanco(main);
    const destino = pastas.find((p) => p.name === "Destino")!;
    const filhas = pastas.filter((p) => p.parentId === destino.id).map((p) => p.name);
    expect(filhas, "Clientes não deveria ser criada: só o conteúdo dela").toEqual(["Sub"]);
  });
});

test("exportar tudo como pastas .txt nunca sobrescreve e exportar uma pasta cria só ela", async ({ ctx, main }) => {
  const saida = join(raiz, "saida");
  mkdirSync(saida);
  await semear(main, BIBLIOTECA);

  const exportarTxt = async () => {
    await menuDeTransferencia(main, "Exportar tudo", "Pastas e arquivos .txt…");
    await escolherPasta(ctx, saida);
  };
  await passo("primeira exportação: pasta CSTM com as pastas e os .txt", async () => {
    await exportarTxt();
    await esperarAviso(main, "4 textos e 3 pastas exportados.");
    expect(readdirSync(saida)).toEqual(["CSTM"]);
    expect(readFileSync(join(saida, "CSTM", "Trabalho", "Assinatura.txt"), "utf8")).toBe("Att., Gabriel");
    expect(readFileSync(join(saida, "CSTM", "Pessoal", "Endereço.txt"), "utf8")).toBe("Rua A, 10");
    expect(readFileSync(join(saida, "CSTM", "Telefone.txt"), "utf8")).toBe("1234");
  });
  await passo("segunda exportação: CSTM (2), a primeira intacta", async () => {
    await exportarTxt();
    await expect.poll(() => readdirSync(saida).sort()).toEqual(["CSTM", "CSTM (2)"]);
    expect(readFileSync(join(saida, "CSTM", "Telefone.txt"), "utf8")).toBe("1234");
    expect(existsSync(join(saida, "CSTM (2)", "Trabalho", "Resposta.txt"))).toBe(true);
  });
  await passo("exportar só a pasta Trabalho (menu de contexto)", async () => {
    const so = join(raiz, "so-trabalho");
    mkdirSync(so);
    const menu = await menuDeContexto(main, "Trabalho");
    await menu.getByRole("menuitem", { name: "Exportar", exact: true }).click();
    await main.getByRole("menuitem", { name: "Pastas e arquivos .txt…", exact: true }).click();
    await escolherPasta(ctx, so);
    await expect.poll(() => readdirSync(so)).toEqual(["Trabalho"]);
    expect(readdirSync(join(so, "Trabalho")).sort()).toEqual(["Assinatura.txt", "Resposta.txt"]);
  });
});

test("exportar o backup JSON (tudo e uma pasta) e importá-lo de volta numa pasta", async ({ ctx, main }) => {
  const saida = join(raiz, "saida");
  mkdirSync(saida);
  await semear(main, BIBLIOTECA);
  const telefone = (await textosDoBanco(main)).find((t) => t.title === "Telefone")!;
  await main.evaluate(
    (id) =>
      (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a?: object) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("set_favorite", {
        id,
        favorite: true,
      }),
    telefone.id,
  );
  await main.reload();
  await arvore(main).waitFor();

  const backup = join(saida, "backup.json");
  await passo("Exportar tudo > Backup JSON…", async () => {
    await menuDeTransferencia(main, "Exportar tudo", "Backup JSON…");
    await escolherArquivo(ctx, backup);
    await esperarAviso(main, "4 textos e 3 pastas exportados.");
    const json = JSON.parse(readFileSync(backup, "utf8")) as { format: string; version: number; items: unknown[] };
    expect(json).toMatchObject({ format: "cstm", version: 1 });
    expect(JSON.stringify(json.items)).toContain("Obrigado pelo contato.");
  });
  await passo("exportar só a pasta Trabalho em JSON (menu de contexto)", async () => {
    const menu = await menuDeContexto(main, "Trabalho");
    await menu.getByRole("menuitem", { name: "Exportar", exact: true }).click();
    await main.getByRole("menuitem", { name: "Backup JSON…", exact: true }).click();
    await escolherArquivo(ctx, join(saida, "Trabalho.json"));
    await expect.poll(() => existsSync(join(saida, "Trabalho.json"))).toBe(true);
    const texto = readFileSync(join(saida, "Trabalho.json"), "utf8");
    expect(texto).toContain("Assinatura");
    expect(texto).not.toContain("Endereço");
  });
  await passo("Importar > Backup JSON… em Destino recria tudo com os favoritos", async () => {
    await linha(main, "Destino").click();
    await menuDeTransferencia(main, "Importar", "Backup JSON…");
    await escolherArquivo(ctx, backup);
    await esperarAviso(main, "4 textos e 3 pastas importados em Destino.");
    const pastas = await pastasDoBanco(main);
    const destino = pastas.find((p) => p.name === "Destino")!;
    const filhas = pastas.filter((p) => p.parentId === destino.id).map((p) => p.name).sort();
    expect(filhas).toEqual(["Destino", "Pessoal", "Trabalho"]);
    const novos = (await textosDoBanco(main)).filter((t) => t.folderId === destino.id);
    expect(novos.map((t) => t.title)).toEqual(["Telefone"]);
    expect(novos[0].favorite, "o favorito deveria vir no backup").toBe(true);
  });
});
