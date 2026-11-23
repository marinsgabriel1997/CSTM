import { expect, test } from "../support/fixtures";

test("primeira execução: o cadastro abre com a Ajuda", async ({ main }) => {
  await expect(main.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
  await expect(main.getByRole("tab", { name: /Básico/ })).toHaveAttribute("aria-selected", "true");
  await expect(main.getByText("O CSTM (Clipboard, Snippets & Text Manager) salva textos")).toBeVisible();
});

test("o menu de colagem existe como página própria", async ({ app }) => {
  const picker = await app.picker();
  expect(new URL(picker.url()).pathname).toMatch(/picker\.html$/);
});
