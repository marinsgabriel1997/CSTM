import { fecharJanelaPeloSistema } from "../support/janela";
import { linhaDaPagina } from "../support/paginas";
import { esperarJanelaPrincipal } from "../support/windows/cenario";
import { abrirMenuDaBandeja, acionarItemDaBandeja } from "../support/windows/bandeja";
import { ENSAIO } from "../support/windows/ensaio";
import { expect, passo, test } from "./fixtures";

// Menu do ícone da bandeja (clique direito real + UI Automation): Configurações, Ajuda, Sobre o CSTM, Abrir cadastro e, por último, Sair.
// Se a bandeja não for estável por UI Automation na primeira rodada real, a falha traz a árvore da barra de tarefas anexada.
test.skip(ENSAIO, "ensaio: só o setup roda");

test("o menu da bandeja abre as páginas e o cadastro; Sair encerra o app", async ({ ctx, main, app }, info) => {
  test.setTimeout(150_000);
  const { helper } = ctx;

  const ocultarCadastro = async () => {
    fecharJanelaPeloSistema(app.pid);
    await esperarJanelaPrincipal(ctx, false);
  };
  const anexarArvore = async () => {
    const barra = await helper.uiaDump({ classe: "Shell_TrayWnd", profundidade: 6, maximo: 200 }).catch((erro) => [String(erro)]);
    const estouro = await helper
      .uiaDump({ classe: "TopLevelWindowForOverflowXamlIsland", profundidade: 6, maximo: 100 })
      .catch((erro) => [String(erro)]);
    await info.attach("uia-bandeja", { body: [...barra, "", ...estouro].join("\n"), contentType: "text/plain" });
  };

  const usarItem = async (nome: string) => {
    await abrirMenuDaBandeja(helper, app).catch(async (erro) => {
      await anexarArvore();
      throw erro;
    });
    const como = await acionarItemDaBandeja(helper, app, nome);
    console.log(`  item "${nome}" acionado por ${como}`);
  };

  for (const item of ["Configurações", "Ajuda", "Sobre o CSTM"] as const) {
    await passo(`com a janela oculta, "${item}" a mostra na página certa`, async () => {
      await ocultarCadastro();
      await usarItem(item);
      await esperarJanelaPrincipal(ctx, true);
      await expect(linhaDaPagina(main, item)).toHaveAttribute("aria-pressed", "true");
    });
  }

  await passo('com a janela oculta, "Abrir cadastro" a mostra', async () => {
    await ocultarCadastro();
    await usarItem("Abrir cadastro");
    await esperarJanelaPrincipal(ctx, true);
  });

  await passo('"Sair" encerra o aplicativo de teste', async () => {
    await usarItem("Sair");
    await expect.poll(() => app.vivo(), { timeout: 15_000, message: "o app de teste não terminou depois de Sair" }).toBe(false);
  });
});
