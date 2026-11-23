import { spawn } from "node:child_process";
import { semear } from "../support/biblioteca";
import { fecharJanelaPeloSistema } from "../support/janela";
import { abrirMenu, desligarHistorico, esperar, esperarJanelaPrincipal, esperarMenuFechado, janelaPrincipal } from "../support/windows/cenario";
import { caminhoDoBuildDeTeste, listarDoBuildDeTeste } from "../support/windows/cstm-instalado";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Fechar a janela de cadastro só a oculta (o app segue na bandeja com o atalho ativo) e abrir o exe de novo traz a instância existente.
test.skip(ENSAIO, "ensaio: só o setup roda");

test.beforeEach(async ({ main }) => {
  await semear(main, { raiz: { Nota: "Texto da nota" } });
  await desligarHistorico(main);
});

test("fechar a janela (X pelo sistema) só a oculta e o atalho continua funcionando", async ({ ctx, app }) => {
  await passo("a janela de cadastro está visível", () => esperarJanelaPrincipal(ctx, true));
  await passo("WM_CLOSE (o mesmo do botão X)", async () => {
    fecharJanelaPeloSistema(app.pid);
    await esperarJanelaPrincipal(ctx, false);
    expect(app.vivo(), "o app não deveria ter terminado").toBe(true);
  });
  await passo("Alt+Q abre o menu com a janela oculta", async () => {
    const picker = await abrirMenu(ctx);
    await expect(picker.getByRole("combobox", { name: "Buscar" })).toBeFocused();
    await ctx.helper.tecla("Esc");
    await esperarMenuFechado(ctx);
  });
});

test("abrir o exe de novo traz a instância existente, sem segundo processo", async ({ ctx, app }) => {
  const { helper } = ctx;
  await passo("ocultar a janela de cadastro", async () => {
    await esperarJanelaPrincipal(ctx, true);
    fecharJanelaPeloSistema(app.pid);
    await esperarJanelaPrincipal(ctx, false);
  });
  const antes = await passo("um único processo do build de teste", async () => {
    const processos = listarDoBuildDeTeste();
    expect(processos.map((p) => p.pid)).toEqual([app.pid]);
    return processos;
  });
  await passo("iniciar o exe de teste de novo (segunda instância)", async () => {
    const segunda = spawn(caminhoDoBuildDeTeste(), [], { stdio: "ignore" });
    const saiu = await new Promise<boolean>((resolver) => {
      segunda.once("exit", () => resolver(true));
      setTimeout(() => resolver(false), 15_000);
    });
    if (!saiu) segunda.kill();
    expect(saiu, "a segunda instância deveria terminar sozinha").toBe(true);
  });
  await passo("a janela de cadastro voltou e continua um só processo", async () => {
    await esperarJanelaPrincipal(ctx, true);
    await esperar(500);
    expect(listarDoBuildDeTeste().map((p) => p.pid)).toEqual(antes.map((p) => p.pid));
    expect(await janelaPrincipal(ctx)).toBeDefined();
    expect(await helper.primeiroPlano()).toMatchObject({ pid: app.pid });
  });
});
