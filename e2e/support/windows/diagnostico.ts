import type { TestInfo } from "@playwright/test";
import type { AppDeTeste } from "../app";
import type { HelperWindows } from "./helper";

/**
 * Anexos de uma falha do teste do Windows: tela inteira, texto da janela alvo, resumo do clipboard (formatos, tamanhos
 * e hashes; nunca o conteúdo), janelas do app e as páginas CDP. Cada item é independente: o que falhar vira um anexo de erro.
 */
export async function anexarDiagnostico(info: TestInfo, helper: HelperWindows, app: AppDeTeste): Promise<void> {
  const tentar = async (nome: string, corpo: () => Promise<void>) => {
    try {
      await corpo();
    } catch (erro) {
      await info.attach(`${nome} (erro)`, { body: String(erro), contentType: "text/plain" });
    }
  };
  const json = (valor: unknown) => JSON.stringify(valor, null, 2);

  await tentar("tela-inteira", async () => {
    const caminho = info.outputPath("tela-inteira.png");
    await helper.capturarTela(caminho);
    await info.attach("tela-inteira", { path: caminho, contentType: "image/png" });
  });
  await tentar("janela-alvo", async () => {
    await info.attach("janela-alvo (texto)", { body: await helper.alvoLer(), contentType: "text/plain" });
    await info.attach("janela-alvo (posição)", { body: json(await helper.alvoPosicao()), contentType: "application/json" });
  });
  await tentar("clipboard", async () => {
    await info.attach("clipboard (resumo, sem conteúdo)", { body: json(await helper.clipResumo()), contentType: "application/json" });
  });
  await tentar("janelas", async () => {
    const pid = app.vivo() ? app.pid : undefined;
    const resumo = {
      primeiroPlano: await helper.primeiroPlano(),
      mouse: await helper.mousePosicao(),
      tela: await helper.telaInfo(),
      janelasDoApp: pid ? await helper.janelas({ pid }) : "o app de teste não está rodando",
    };
    await info.attach("janelas e mouse", { body: json(resumo), contentType: "application/json" });
  });
  const paginas = app.paginas();
  for (const [i, pagina] of paginas.entries()) {
    await tentar(`pagina-${i}`, async () => {
      const resumo = {
        url: pagina.url(),
        titulo: await pagina.title(),
        textoVisivel: (await pagina.locator("body").innerText({ timeout: 3_000 })).slice(0, 4_000),
      };
      await info.attach(`página CDP ${i} (${new URL(pagina.url()).pathname})`, { body: json(resumo), contentType: "application/json" });
      await info.attach(`página CDP ${i} (captura)`, { body: await pagina.screenshot({ timeout: 5_000 }), contentType: "image/png" });
    });
  }
}
