import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { expect, test } from "../support/fixtures";
import { invocar } from "../support/biblioteca";
import { abrirPagina, linhaDaPagina } from "../support/paginas";

const versaoDoProjeto = (JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { version: string }).version;

test.describe("Ajuda", () => {
  test("abre sozinha só na primeira execução", async ({ app, main }) => {
    await expect(main.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
    await expect(linhaDaPagina(main, "Ajuda")).toHaveAttribute("aria-pressed", "true");

    // Recarregar a janela e reiniciar o app: não é mais a primeira execução.
    await main.reload();
    await expect(main.getByRole("heading", { name: "Bem-vindo ao CSTM", level: 1 })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Ajuda", level: 1 })).toHaveCount(0);
    await expect(linhaDaPagina(main, "Ajuda")).toHaveAttribute("aria-pressed", "false");

    await app.reiniciar();
    const depois = await app.main();
    await expect(depois.getByRole("heading", { name: "Bem-vindo ao CSTM", level: 1 })).toBeVisible();
    await expect(depois.getByRole("heading", { name: "Ajuda", level: 1 })).toHaveCount(0);
    await expect(linhaDaPagina(depois, "Ajuda")).toHaveAttribute("aria-pressed", "false");
    expect(await invocar(depois, "take_help_prompt")).toBe(false);
  });

  test("abas Básico e Avançado", async ({ main }) => {
    const basico = main.getByRole("tab", { name: /Básico/ });
    const avancado = main.getByRole("tab", { name: /Avançado/ });
    await expect(basico).toHaveAttribute("aria-selected", "true");
    await expect(main.getByRole("tabpanel", { name: "Básico" })).toBeVisible();
    await expect(main.getByRole("tabpanel", { name: "Avançado" })).toHaveCount(0);

    await avancado.click();
    await expect(avancado).toHaveAttribute("aria-selected", "true");
    await expect(basico).toHaveAttribute("aria-selected", "false");
    await expect(main.getByRole("tabpanel", { name: "Avançado" })).toBeVisible();
    await expect(main.getByRole("tabpanel", { name: "Básico" })).toHaveCount(0);
    await expect(main.getByRole("heading", { name: "Importar e exportar" })).toBeVisible();

    await basico.click();
    await expect(main.getByRole("tabpanel", { name: "Básico" })).toBeVisible();
  });

  test("Ver como importar leva à seção Importar e exportar da aba Avançado", async ({ main }) => {
    await main.getByRole("button", { name: "Ver como importar" }).click();
    await expect(main.getByRole("tab", { name: /Avançado/ })).toHaveAttribute("aria-selected", "true");
    await expect(main.getByRole("tabpanel", { name: "Avançado" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Importar e exportar" })).toBeVisible();
  });

  // POSSÍVEL BUG DO APP: na primeira vez que a aba Avançado abre, as imagens (loading="lazy") ainda não têm altura
  // e carregam depois da rolagem; o título "Importar e exportar" fica logo abaixo da área visível
  // (top 1009 px numa janela de 1000 px). Clicando de novo (imagens já carregadas), a seção fica no topo (161 px).
  test.fixme("Ver como importar deixa a seção Importar e exportar visível na primeira vez", async ({ main }) => {
    await main.getByRole("button", { name: "Ver como importar" }).click();
    await expect(main.getByRole("heading", { name: "Importar e exportar" })).toBeInViewport();
  });

  test("F1 abre a Ajuda de qualquer lugar e a linha do rodapé alterna a página", async ({ main }) => {
    // Sai da Ajuda da primeira execução, para o F1 ter o que abrir.
    await linhaDaPagina(main, "Ajuda").click();
    await expect(main.getByRole("heading", { name: "Ajuda", level: 1 })).toHaveCount(0);

    await abrirPagina(main, "Configurações");
    await expect(main.getByRole("textbox", { name: "Atalho" })).toBeVisible();
    await main.keyboard.press("F1");
    await expect(main.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
    await expect(main.getByRole("textbox", { name: "Atalho" })).toHaveCount(0);
  });
});

test.describe("Sobre", () => {
  test("mostra a versão do projeto e a pasta dos dados do build de teste", async ({ main }) => {
    await abrirPagina(main, "Sobre o CSTM");
    await expect(main.getByRole("heading", { name: "CSTM", level: 1 })).toBeVisible();
    await expect(main.getByText(`versão ${versaoDoProjeto}`)).toBeVisible();
    expect(await invocar(main, "plugin:app|version")).toBe(versaoDoProjeto);

    const pasta = main.getByText(/com\.gabriel\.cstm\.teste$/);
    await expect(pasta).toBeVisible();
    // O botão e o link existem, mas não são clicados: abririam o Explorer e o navegador.
    await expect(main.getByRole("button", { name: "Abrir pasta" })).toBeEnabled();
    await expect(main.getByRole("button", { name: "github.com/marinsgabriel1997/CSTM" })).toBeVisible();
    expect(await invocar<string>(main, "get_data_dir")).toMatch(/com\.gabriel\.cstm\.teste$/);
  });
});
