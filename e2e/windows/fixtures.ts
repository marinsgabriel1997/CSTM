import { expect, test as base, type Page } from "@playwright/test";
import { AppDeTeste } from "../support/app";
import type { Ctx } from "../support/windows/cenario";
import { anexarDiagnostico } from "../support/windows/diagnostico";
import { HelperWindows, type PosicaoDoAlvo } from "../support/windows/helper";
import { arquivoDoWindows, hora, registrar } from "../support/windows/log";

interface DoTeste {
  /** O app de teste, aberto com dados limpos e o atalho padrão Alt+Q (o CSTM instalado está fechado). */
  app: AppDeTeste;
  /** Janela de cadastro do app de teste. */
  main: Page;
  /** Janela de teste própria (caixa de texto), aberta; a posição inicial vem aqui, atualize com helper.alvoPosicao(). */
  alvo: PosicaoDoAlvo;
  /** Helper, app, janela de cadastro e janela alvo juntos, para as cenas de support/windows/cenario.ts. */
  ctx: Ctx;
  /** Em falha, anexa tela inteira, janela alvo, resumo do clipboard e páginas CDP ao relatório. */
  diagnostico: void;
}

interface DoWorker {
  /** PowerShell persistente com a entrada real, o clipboard e a janela alvo. */
  helper: HelperWindows;
}

export const test = base.extend<DoTeste, DoWorker>({
  helper: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, usar) => {
      const helper = await HelperWindows.iniciar(arquivoDoWindows("helper-worker.log"));
      try {
        await usar(helper);
      } finally {
        await helper.soltarModificadores().catch(() => undefined);
        await helper.encerrar();
      }
    },
    { scope: "worker" },
  ],
  app: async ({ helper }, usar) => {
    const app = new AppDeTeste();
    try {
      await app.iniciar(true);
      await usar(app);
    } finally {
      // Nunca deixar um diálogo modal aberto (nativo de arquivo ou de erro): fecha antes de encerrar o build de teste.
      if (app.vivo()) await helper.dialogoFechar(app.pid).catch(() => undefined);
      await app.encerrar();
    }
  },
  main: async ({ app }, usar) => {
    await usar(await app.main());
  },
  alvo: async ({ helper }, usar) => {
    const posicao = await helper.alvoAbrir({ x: 120, y: 120, largura: 640, altura: 420 });
    try {
      await usar(posicao);
    } finally {
      await helper.alvoFechar().catch(() => undefined);
    }
  },
  ctx: async ({ helper, app, main, alvo }, usar) => {
    await usar({ helper, app, main, alvo });
  },
  diagnostico: [
    async ({ helper, app, alvo }, usar, info) => {
      void alvo;
      await usar();
      if (info.status !== info.expectedStatus && info.status !== "skipped") await anexarDiagnostico(info, helper, app);
    },
    { auto: true },
  ],
});

/** Passo do teste: aparece no relatório HTML e no terminal com o horário de início e a duração. */
export function passo<T>(titulo: string, corpo: () => Promise<T>): Promise<T> {
  return test.step(`${hora()} ${titulo}`, async () => {
    const inicio = Date.now();
    registrar(`> ${titulo}`);
    try {
      const resultado = await corpo();
      registrar(`  ok (${Date.now() - inicio} ms)`);
      return resultado;
    } catch (erro) {
      registrar(`  FALHOU: ${titulo}`);
      throw erro;
    }
  });
}

export { expect };
