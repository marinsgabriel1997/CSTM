import { defineConfig } from "@playwright/test";

// Camada do Windows: teclado, mouse e clipboard REAIS, com o CSTM instalado fechado durante a execução.
// Só roda por "npm run test:windows", e só depois de avisar o usuário (o teste toma o PC).
// O globalSetup guarda o clipboard e fecha o CSTM instalado; o globalTeardown devolve os dois, sempre.
export default defineConfig({
  testDir: "./windows",
  testMatch: /.*\.spec\.ts/,
  projects: [{ name: "windows" }],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "./.resultados/windows/relatorio", open: "never" }]],
  // Curto de propósito: um teste preso (diálogo modal, menu aberto) não pode tomar o PC por minutos.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "./.resultados/windows/artefatos",
  globalSetup: "./windows/global-setup.ts",
  globalTeardown: "./windows/global-teardown.ts",
});
