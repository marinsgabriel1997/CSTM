import { test as base, expect, type Page } from "@playwright/test";
import { AppDeTeste } from "./app";

interface Fixtures {
  /** O app de teste, aberto com dados limpos; `app.reiniciar()` reabre mantendo os dados. */
  app: AppDeTeste;
  /** Janela de cadastro do app (atualizada após `app.reiniciar()` por `await app.main()`). */
  main: Page;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, usar) => {
    const app = new AppDeTeste();
    try {
      await app.iniciar(true);
      await usar(app);
    } finally {
      await app.encerrar();
    }
  },
  main: async ({ app }, usar) => {
    await usar(await app.main());
  },
});

export { expect };
