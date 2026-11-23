import { defineConfig } from "@playwright/test";

// Testes de interface no aplicativo real (build de teste, identificador com.gabriel.cstm.teste).
// Sem paralelismo e sem retries: os testes compartilham um único app e uma pasta de dados.
export default defineConfig({
  testDir: ".",
  projects: [{ name: "app", testDir: "./app" }],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "./.resultados/app",
});
