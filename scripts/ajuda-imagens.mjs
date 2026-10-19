// Gera as imagens da página Ajuda a partir dos protótipos HTML de docs/prototipo/.
// Usa o Edge em modo headless, controlado pelo protocolo CDP (WebSocket), sem dependências novas.
// Uso: npm run ajuda:imagens [nome-da-captura ...]
//      node scripts/ajuda-imagens.mjs --explorar <arquivo.html> "<hash>" <saida.png>
//      (a segunda forma captura a página inteira, só para investigar um estado)
//      node scripts/ajuda-imagens.mjs --prototipo
//      (copia os textos de src/helpContent.ts para docs/prototipo/ajuda.html; não abre o Edge)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROTOTIPOS = path.join(RAIZ, "docs", "prototipo");
const SAIDA = path.join(RAIZ, "src", "assets", "ajuda");

const PAD_PADRAO = 12; // folga ao redor dos alvos do recorte
const VIEWPORT_PADRAO = { width: 1280, height: 1100 };

// ---------------------------------------------------------------------------------------------
// Capturas. Alvo (T) = seletor CSS, ou { css, text, closest }: primeiro elemento do seletor cujo
// texto contém `text`, opcionalmente subindo ao ancestral `closest`.
// `clip` = caixa da captura (união dos alvos + pad). `marks` = retângulos vermelhos (n = círculo numerado).
// ---------------------------------------------------------------------------------------------

// Picker: "nav=clique" mostra o menu de uma coluna só (o estado vem de `estado=`); a cascata não
// aceita `estado=` e traz anotações do protótipo.
const PICKER = "nav=clique&cenario=normal&";
// Menu de colagem, com o cursor do mouse que o abriu (um pouco do "programa" ao fundo).
const MENU = ["#picker", "#desk .mouse"];
// Linha de texto que fica selecionada nas capturas 5 e 9 (o picker seleciona a linha sob o mouse).
const TEXTO = { css: "#list .row.snippet", text: "Telefone" };

const CAPTURAS = [
  // 1. Botão Novo e o menu aberto
  {
    name: "basico-1-novo-texto",
    page: "cadastro.html",
    hash: "estado=criacao",
    clip: [".tree-head", ".menu"],
    marks: [{ target: ".btn.accent", n: 1 }, { target: { css: ".menu .item", text: "Novo texto" }, n: 2 }],
  },
  // 2. Título, conteúdo e aviso de gravação
  {
    name: "basico-2-titulo-conteudo",
    page: "cadastro.html",
    hash: "estado=edicao",
    clip: ".window",
    marks: [
      { target: ".editor-pane .title", n: 1 },
      { target: ".editor-pane .content", n: 2 },
      { target: { css: ".statusbar .st", text: "Todas as alterações salvas" } },
    ],
  },
  // 3. Arrastar para uma pasta
  {
    name: "basico-3-pastas",
    pad: 0, // sem folga: o painel começa na borda da janela
    page: "cadastro.html",
    hash: "estado=arrastar-pasta",
    clip: [".tree-head", ".tree .row", ".drag-ghost"],
    marks: [{ target: ".drag-ghost", n: 1 }, { target: ".drop-into", n: 2 }],
  },
  // 4. Menu de colagem aberto
  {
    name: "basico-4-menu-de-colagem",
    page: "picker.html",
    hash: PICKER + "estado=raiz",
    clip: MENU,
    pad: 30,
    marks: [{ target: "#picker .search" }],
  },
  // 5. Escolher um texto: linha selecionada e botão Copiar
  {
    name: "basico-5-escolher",
    page: "picker.html",
    hash: PICKER + "estado=raiz",
    actions: [{ hover: TEXTO }],
    clip: MENU,
    pad: 30,
    marks: [{ target: "#list .row.selected", n: 1 }, { target: "#list .row.selected button[title^=Copiar]", n: 2 }],
  },
  // 6. Ícone do CSTM na bandeja do Windows e o menu com Sair
  {
    name: "basico-6-bandeja",
    page: "ajuda.html",
    hash: "estado=encerrar",
    clip: [".tray-menu", ".taskbar .clock", "#tray-cstm"],
    marks: [{ target: "#tray-cstm", n: 1 }, { target: { css: ".tray-menu div", text: "Sair" }, n: 2 }],
  },
  // 7. Busca e filtro de favoritos
  {
    name: "avancado-busca",
    pad: 0, // sem folga: o painel começa na borda da janela
    page: "cadastro.html",
    hash: "estado=busca",
    clip: [".tree-head", ".tree .row"],
    marks: [{ target: ".tree-head .search", n: 1 }, { target: ".chips .chip", n: 2 }],
  },
  // 8. Pastas virtuais Favoritos e Mais usados
  {
    name: "avancado-favoritos",
    page: "picker.html",
    hash: PICKER + "estado=raiz",
    clip: MENU,
    pad: 30,
    marks: [{ target: { css: "#list .row", text: "Favoritos" } }, { target: { css: "#list .row", text: "Mais usados" } }],
  },
  // 9. Botões dos modos de colagem na linha selecionada (do primeiro modo até o último, antes do Copiar)
  {
    name: "avancado-modos",
    page: "picker.html",
    hash: PICKER + "estado=raiz",
    actions: [{ hover: TEXTO }],
    clip: MENU,
    pad: 30,
    marks: [{ target: ["#list .row.selected .mode", { css: "#list .row.selected .mode", nth: -1 }] }],
  },
  // 10. Dentro do Histórico: a linha de volta mostra "Histórico"
  {
    name: "avancado-historico",
    page: "picker.html",
    hash: PICKER + "estado=historico",
    clip: MENU,
    pad: 30,
    marks: [{ target: "#list .row.back" }],
  },
  // 11. Menu de contexto de uma pasta, com a linha Raiz da árvore
  {
    name: "avancado-arvore",
    pad: 0, // sem folga: o painel começa na borda da janela
    page: "cadastro.html",
    hash: "estado=pasta-novo",
    clip: [".tree-head", ".tree .row", ".menu"],
    marks: [{ target: { css: ".tree .row.folder", text: "Raiz" } }, { target: ".menu" }],
  },
  // 12. Lixeira: linha na árvore e botões de restaurar e esvaziar
  {
    name: "avancado-lixeira",
    page: "cadastro.html",
    hash: "estado=lixeira",
    clip: ".window",
    marks: [
      { target: ".row.trash", n: 1 },
      { target: { css: ".folder-actions .btn", text: "Restaurar" } },
      { target: { css: ".folder-actions .btn", text: "Esvaziar lixeira" } },
    ],
  },
  // 13. Botão ⋯ da árvore e o item Importar
  {
    name: "avancado-importar",
    pad: 0, // sem folga: o painel começa na borda da janela
    page: "cadastro.html",
    hash: "estado=importar",
    clip: [".tree-head", ".menu"],
    marks: [{ target: "[title='Importar e exportar']", n: 1 }, { target: { css: ".menu .item", text: "Importar" }, n: 2 }],
  },
  // 14. Linha Configurações no rodapé do painel
  {
    name: "avancado-configuracoes",
    page: "configuracoes.html",
    hash: "estado=atual",
    clip: [".tree-foot", "#editor"], // a página e o rodapé do painel, sem a árvore simplificada do protótipo
    marks: [{ target: "#gear", n: 1 }],
  },
];

// ---------------------------------------------------------------------------------------------
// Edge + CDP
// ---------------------------------------------------------------------------------------------

function acharEdge() {
  const candidatos = [
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const achado = candidatos.find((c) => existsSync(c));
  if (!achado) throw new Error(`Edge não encontrado. Defina EDGE_PATH. Procurado em: ${candidatos.join("; ")}`);
  return achado;
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Pede uma porta livre ao sistema abrindo e fechando um servidor temporário.
async function portaLivre() {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// Tenta repetidamente até o Edge começar a responder.
async function esperarJson(url, opcoes) {
  let ultimo;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url, opcoes);
      if (r.ok) return await r.json();
      ultimo = new Error(`HTTP ${r.status}`);
    } catch (e) {
      ultimo = e;
    }
    await pausa(200);
  }
  throw new Error(`O Edge não respondeu em ${url}: ${ultimo?.message}`);
}

// Cliente CDP mínimo: cada comando tem um id e uma promessa; eventos vão para uma lista de ouvintes.
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.proximo = 1;
    this.pendentes = new Map();
    this.ouvintes = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pendentes.get(msg.id);
        this.pendentes.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.metodo}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        this.ouvintes.forEach((o) => o(msg));
      }
    });
  }
  static async conectar(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("Falha ao conectar ao WebSocket do Edge")), { once: true });
    });
    return new Cdp(ws);
  }
  enviar(metodo, params = {}) {
    const id = this.proximo++;
    return new Promise((resolve, reject) => {
      this.pendentes.set(id, { resolve, reject, metodo });
      this.ws.send(JSON.stringify({ id, method: metodo, params }));
    });
  }
  // Espera um evento (ex.: Page.loadEventFired); registre antes de disparar a ação.
  aguardar(evento, ms = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Tempo esgotado esperando ${evento}`)), ms);
      const o = (msg) => {
        if (msg.method === evento) {
          clearTimeout(t);
          this.ouvintes = this.ouvintes.filter((x) => x !== o);
          resolve(msg.params);
        }
      };
      this.ouvintes.push(o);
    });
  }
  async avaliar(expressao) {
    const r = await this.enviar("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  fechar() {
    this.ws.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Código executado dentro da página
// ---------------------------------------------------------------------------------------------

// Resolve um alvo em elementos. Alvo = seletor CSS, ou { css, text, closest, nth }:
// os elementos do seletor cujo texto contém `text` (só os mais internos, para não pegar contêineres),
// `nth` escolhe um deles (negativo = a partir do fim), `closest` sobe a um ancestral.
const JS_RESOLVER = `
const norm = (s) => (s || "").replace(/\\s+/g, " ").trim();
const resolverTodos = (t) => {
  if (typeof t === "string") return [...document.querySelectorAll(t)];
  let lista = [...document.querySelectorAll(t.css)];
  if (t.text !== undefined) {
    lista = lista.filter((e) => norm(e.textContent).includes(t.text));
    lista = lista.filter((e) => !lista.some((o) => o !== e && e.contains(o)));
  }
  if (t.nth !== undefined) lista = lista.slice(t.nth, t.nth === -1 ? undefined : t.nth + 1);
  if (t.closest) lista = lista.map((e) => e.closest(t.closest)).filter(Boolean);
  return lista;
};
const resolver = (t) => resolverTodos(t)[0] || null;
const caixa = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
`;

// Ações sintéticas (hover/click) disparadas antes da captura.
function jsAcao(acao) {
  const hover = "hover" in acao;
  return `(() => {
    ${JS_RESOLVER}
    const el = resolver(${JSON.stringify(hover ? acao.hover : acao.click)});
    if (!el) return false;
    const eventos = ${hover}
      ? ["pointerover", "mouseover", "pointerenter", "mouseenter", "pointermove", "mousemove"]
      : ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    for (const e of eventos) el.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`;
}

// Mede os alvos do recorte e das marcações (cada um vira caixa ou { erro }).
// Um alvo em lista (array) vira a união das caixas; no recorte, um seletor em texto vale para todos os
// elementos que casam (ex.: o menu e seus submenus).
function jsMedir(captura) {
  return `(() => {
    ${JS_RESOLVER}
    const uniao = (caixas) => {
      const x0 = Math.min(...caixas.map((b) => b.x)), y0 = Math.min(...caixas.map((b) => b.y));
      const x1 = Math.max(...caixas.map((b) => b.x + b.w)), y1 = Math.max(...caixas.map((b) => b.y + b.h));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    const medir = (t, todos) => {
      const alvos = Array.isArray(t) ? t : [t];
      const caixas = [];
      for (const a of alvos) {
        const els = todos ? resolverTodos(a) : [resolver(a)].filter(Boolean);
        if (!els.length) return { erro: "não encontrado" };
        caixas.push(...els.map(caixa));
      }
      if (caixas.some((c) => c.w <= 0 || c.h <= 0)) return { erro: "caixa vazia" };
      return uniao(caixas);
    };
    const clip = ${JSON.stringify([].concat(captura.clip))}.map((t) => ({ t, c: medir(t, true) }));
    const marks = ${JSON.stringify(captura.marks ?? [])}.map((m) => ({ t: m.target, n: m.n, c: medir(m.target, false) }));
    return { clip, marks };
  })()`;
}

// Desliga animações, esconde a barra de estados do protótipo e espera fontes e layout.
const JS_PREPARAR = `(async () => {
  const s = document.createElement("style");
  s.textContent = "*{transition:none!important;animation:none!important;caret-color:transparent!important}.proto-bar,.proto-note,#note,#cnote{visibility:hidden!important}";
  document.head.appendChild(s);
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));
  return true;
})()`;

// Desenha o overlay com os retângulos e círculos numerados, já em coordenadas da viewport.
function jsOverlay(marcas, area) {
  return `(() => {
    const marcas = ${JSON.stringify(marcas)}, area = ${JSON.stringify(area)};
    const ov = document.createElement("div");
    ov.id = "ajuda-overlay";
    ov.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    for (const m of marcas) {
      const r = document.createElement("div");
      r.style.cssText = "position:absolute;box-sizing:border-box;border:3px solid #D13438;border-radius:6px;" +
        "left:" + m.x + "px;top:" + m.y + "px;width:" + m.w + "px;height:" + m.h + "px";
      ov.appendChild(r);
      if (m.n) {
        const d = 22;
        // Centrado no vértice superior esquerdo; empurrado para dentro se sair da área.
        const x = Math.min(Math.max(m.x - d / 2, area.x), area.x + area.w - d);
        const y = Math.min(Math.max(m.y - d / 2, area.y), area.y + area.h - d);
        const c = document.createElement("div");
        c.textContent = String(m.n);
        c.style.cssText = "position:absolute;box-sizing:border-box;width:" + d + "px;height:" + d + "px;border-radius:50%;" +
          "background:#D13438;color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);" +
          "display:flex;align-items:center;justify-content:center;font:700 13px/1 'Segoe UI',sans-serif;" +
          "left:" + x + "px;top:" + y + "px";
        ov.appendChild(c);
      }
    }
    document.body.appendChild(ov);
  })()`;
}

// ---------------------------------------------------------------------------------------------
// Captura
// ---------------------------------------------------------------------------------------------

// Navega do zero (about:blank antes) porque mudar só o hash não recarrega a página.
async function abrir(cdp, arquivo, hash) {
  let carregado = cdp.aguardar("Page.loadEventFired");
  await cdp.enviar("Page.navigate", { url: "about:blank" });
  await carregado;
  carregado = cdp.aguardar("Page.loadEventFired");
  const url = pathToFileURL(path.join(PROTOTIPOS, arquivo)).href + "#" + hash + "&tema=claro";
  await cdp.enviar("Page.navigate", { url });
  await carregado;
  await cdp.avaliar(JS_PREPARAR);
}

async function capturar(cdp, c) {
  const vp = { ...VIEWPORT_PADRAO, ...c.viewport };
  await cdp.enviar("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 2, mobile: false });
  await abrir(cdp, c.page, c.hash);

  for (const acao of c.actions ?? []) {
    const ok = await cdp.avaliar(jsAcao(acao));
    if (!ok) throw new Error(`Captura "${c.name}": alvo da ação ${JSON.stringify(acao)} não encontrado`);
    await cdp.avaliar(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  }

  const med = await cdp.avaliar(jsMedir(c));
  for (const { t, c: caixa } of [...med.clip, ...med.marks]) {
    if (caixa.erro) throw new Error(`Captura "${c.name}": alvo ${JSON.stringify(t)} — ${caixa.erro}`);
  }

  const pad = c.pad ?? PAD_PADRAO;
  const FOLGA_MARCA = 4; // afastamento do retângulo vermelho em relação ao alvo
  const marcas = med.marks.map((m) => ({
    x: m.c.x - FOLGA_MARCA, y: m.c.y - FOLGA_MARCA, w: m.c.w + 2 * FOLGA_MARCA, h: m.c.h + 2 * FOLGA_MARCA, n: m.n,
  }));
  const uniao = (caixas) => {
    const x0 = Math.min(...caixas.map((b) => b.x)), y0 = Math.min(...caixas.map((b) => b.y));
    const x1 = Math.max(...caixas.map((b) => b.x + b.w)), y1 = Math.max(...caixas.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const base = uniao(med.clip.map((m) => m.c));
  const limites = [{ x: base.x - pad, y: base.y - pad, w: base.w + 2 * pad, h: base.h + 2 * pad }];
  // A área inclui as marcações e seus círculos (vértice ± 11 px) mais 6 px.
  for (const m of marcas) {
    limites.push({ x: m.x - 11 - 6, y: m.y - 11 - 6, w: m.w + 22 + 12, h: m.h + 22 + 12 });
  }
  const bruta = uniao(limites);
  // Limita à janela (viewport).
  const x = Math.max(0, Math.floor(bruta.x)), y = Math.max(0, Math.floor(bruta.y));
  const area = {
    x, y,
    w: Math.min(vp.width, Math.ceil(bruta.x + bruta.w)) - x,
    h: Math.min(vp.height, Math.ceil(bruta.y + bruta.h)) - y,
  };

  await cdp.avaliar(jsOverlay(marcas, area));
  const shot = await cdp.enviar("Page.captureScreenshot", {
    format: "webp", quality: 90, captureBeyondViewport: false,
    clip: { x: area.x, y: area.y, width: area.w, height: area.h, scale: 1 },
  });
  return { dados: Buffer.from(shot.data, "base64"), w: area.w, h: area.h };
}

// ---------------------------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------------------------

// Sincroniza o texto do protótipo ajuda.html com src/helpContent.ts. O módulo TypeScript é importado de
// uma cópia temporária, com os imports de imagem trocados por caminhos (o protótipo lê os mesmos arquivos).
async function sincronizarPrototipo() {
  const temp = mkdtempSync(path.join(tmpdir(), "cstm-ajuda-proto-"));
  let ajuda;
  try {
    // Com "type": "module", o Node trata a cópia como ESM ao remover os tipos.
    writeFileSync(path.join(temp, "package.json"), '{ "type": "module" }');
    const copia = path.join(temp, "helpContent.ts");
    const fonte = readFileSync(path.join(RAIZ, "src", "helpContent.ts"), "utf8");
    writeFileSync(copia, fonte.replace(/^import (\w+) from "\.\/assets\/ajuda\/([^"]+)";\r?$/gm,
      (_, nome, arquivo) => `const ${nome} = "../../src/assets/ajuda/${arquivo}";`));
    ajuda = await import(pathToFileURL(copia).href);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const imagem = (s) => (s.image ? [s.image.src, s.image.alt] : undefined);
  const BASIC = ajuda.BASIC_STEPS.map((s) => [s.title, s.text, imagem(s)]);
  const ADVANCED = ajuda.ADVANCED_SECTIONS.map((s) => [s.title, s.paragraphs, imagem(s)]);

  const arquivo = path.join(PROTOTIPOS, "ajuda.html");
  const original = readFileSync(arquivo, "utf8");
  // As duas linhas de dados ficam consecutivas; a troca preserva o fim de linha.
  const linhas = /^  const BASIC = [^\r\n]*(\r?\n)  const ADVANCED = [^\r\n]*$/gm;
  if ((original.match(linhas) ?? []).length !== 1) {
    throw new Error("ajuda.html: não achei as linhas consecutivas de 'const BASIC' e 'const ADVANCED'");
  }
  // Funções como replacer: o JSON pode conter "$" e isso não pode ser interpretado como padrão.
  let novo = original.replace(linhas, (_, quebra) =>
    `  const BASIC = ${JSON.stringify(BASIC)};${quebra}  const ADVANCED = ${JSON.stringify(ADVANCED)};`);

  const intro = /<p class="intro">[\s\S]*?<\/p>/g;
  if ((novo.match(intro) ?? []).length !== 1) {
    throw new Error('ajuda.html: esperava exatamente um <p class="intro">…</p>');
  }
  novo = novo.replace(intro, () => `<p class="intro">${ajuda.HELP_INTRO}</p>`);

  if (novo === original) {
    console.log("ajuda.html já estava sincronizado");
  } else {
    writeFileSync(arquivo, novo);
    console.log("ajuda.html sincronizado");
  }
}

async function principal() {
  const args = process.argv.slice(2);
  if (args[0] === "--prototipo") return sincronizarPrototipo();
  const explorar = args[0] === "--explorar";
  let alvos = CAPTURAS;
  if (!explorar && args.length) {
    const desconhecidas = args.filter((a) => !CAPTURAS.some((c) => c.name === a));
    if (desconhecidas.length) throw new Error(`Captura(s) desconhecida(s): ${desconhecidas.join(", ")}`);
    alvos = CAPTURAS.filter((c) => args.includes(c.name));
  }

  const porta = await portaLivre();
  const perfil = mkdtempSync(path.join(tmpdir(), "cstm-ajuda-"));
  const edge = spawn(acharEdge(), [
    "--headless=new", `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    "--disable-gpu", "--no-first-run", "--hide-scrollbars", "about:blank",
  ], { stdio: "ignore" });
  let cdp;
  try {
    const base = `http://127.0.0.1:${porta}`;
    const paginas = await esperarJson(`${base}/json/list`);
    const pagina = paginas.find((p) => p.type === "page") ?? (await esperarJson(`${base}/json/new?about:blank`, { method: "PUT" }));
    cdp = await Cdp.conectar(pagina.webSocketDebuggerUrl);
    await cdp.enviar("Page.enable");

    if (explorar) {
      const [, arquivo, hash, saida] = args;
      await cdp.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1800, deviceScaleFactor: 1, mobile: false });
      await abrir(cdp, arquivo, hash);
      const shot = await cdp.enviar("Page.captureScreenshot", { format: "png" });
      writeFileSync(saida, Buffer.from(shot.data, "base64"));
      return;
    }

    mkdirSync(SAIDA, { recursive: true });
    for (const c of alvos) {
      const { dados, w, h } = await capturar(cdp, c);
      // Só grava depois de capturar; o rename evita deixar imagem parcial.
      const destino = path.join(SAIDA, `${c.name}.webp`);
      const temp = destino + ".tmp";
      writeFileSync(temp, dados);
      renameSync(temp, destino);
      console.log(`${c.name}.webp  ${w * 2}x${h * 2} px  ${(statSync(destino).size / 1024).toFixed(1)} KB`);
    }
  } finally {
    cdp?.fechar();
    edge.kill();
    await pausa(500);
    try { rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* o Edge pode demorar a soltar os arquivos */ }
  }
}

principal().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});
