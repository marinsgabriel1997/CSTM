# 083 — Modos de colagem no Histórico

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-15
- Concluído em: 2026-10-15

## Objetivo

Oferecer nos itens de texto do Histórico do clipboard os mesmos modos de colagem dos textos cadastrados (Markdown, Sem formatação, Formatado e Google Chat), convertendo o que foi copiado em qualquer formato: markdown, sintaxe do Google Chat ou texto formatado.

## Contexto

- O plano 082 criou `src-tauri/src/markdown.rs` (`PasteFormat`, `convert(md, format)`), os botões de modo na linha selecionada do picker (`src/Picker.tsx`) e o modo padrão nas Configurações; ficaram de fora os itens do Histórico.
- O Histórico (plano 077) guarda em `clipboard_items` o texto (`text`), o "HTML Format" (`html`, bytes como vieram, com o cabeçalho CF_HTML) e o RTF de cada cópia. `paste_clipboard_item(id)` e `copy_clipboard_item(id)` em `src-tauri/src/commands.rs` devolvem o item como foi copiado.
- Situações do usuário: copiar um texto em markdown e mandá-lo no Chat ou sem formatação; copiar uma mensagem do Chat e colá-la formatada num e-mail.

## Decisões do usuário

- `Enter`, clique e **Copiar** no Histórico continuam colando o original, como foi copiado. Os quatro modos ficam em botões na linha de texto selecionada.
- Sempre que possível, o item é convertido primeiro para markdown, e daí para o modo escolhido: a formatação que veio junto (HTML) vira markdown, e um texto escrito na sintaxe do Google Chat também.

## Escopo

### Incluído

- **Normalização para markdown (backend)**, função pura com testes, aplicada a itens de texto:
  1. Com HTML que tenha formatação de verdade (negrito, itálico, tachado, código, listas, títulos, links, citação), o fragmento HTML (extraído pelos offsets do CF_HTML) é convertido para markdown.
  2. Sem esse HTML, o texto que parece da sintaxe do Google Chat (`*x*` ou `~x~` de um caractere, sem `**` nem `~~`) tem `*x*` convertido em `**x**` e `~x~` em `~~x~~`; `_x_`, código, citação e listas já coincidem com o markdown.
  3. Nos demais casos o texto é usado como está.
- **Conversão de HTML**: crate `htmd` (HTML para markdown, licença Apache-2.0), a confirmar na Fase 2; `Cargo.lock` atualizado.
- **Comandos**: `paste_clipboard_item` e `copy_clipboard_item` ganham `format` opcional; sem ele, o original como hoje. Com ele, o resultado de `convert(normalizado, format)` é escrito como nos textos cadastrados. `src/api.ts` e `src/test/fakeApi.ts` acompanham.
- **Picker**: na linha de texto do Histórico selecionada, os quatro botões de modo (Markdown, Sem formatação, Formatado e Google Chat) ao lado de Copiar, no mesmo estilo e posição do 082. Imagens não têm modos.
- Restauração do clipboard (p60) e o reposicionamento do item no topo do Histórico ao usá-lo seguem como hoje.
- Desenho (`docs/telas.md`, `docs/prototipo/picker.html`), Ajuda (`src/helpContent.ts`), `CHANGELOG.md` e testes Rust e Vitest.

### Fora do escopo

- Mudar o que `Enter` e **Copiar** fazem no Histórico.
- Modos para imagens; conversão de RTF (só HTML e texto são lidos).
- Detectar a sintaxe do Google Chat nos textos cadastrados.

## Estado desejado

Qualquer texto copiado (markdown, mensagem do Chat ou trecho formatado de um e-mail ou documento) pode ser colado de novo pelo Histórico como markdown, texto limpo, texto formatado ou no formato do Google Chat.

## Riscos e premissas

- A detecção da sintaxe do Chat é heurística: um markdown com `*itálico*` de um asterisco e sem `**` será lido como Chat (vira negrito). É o caso menos comum, e o original continua no `Enter`.
- HTML "formatado" só por estilos (por exemplo `<span style="font-weight:700">`, como no Google Docs) pode não ser reconhecido pelo conversor; nesse caso vale o texto. Conferir no Marco copiando do Gmail, do Word, do Google Docs e da página do Chat.
- Programas que põem HTML sem formatação no clipboard (como o VS Code, que manda o código colorido) não devem desviar a leitura: sem tags de formatação, vale o texto, e um markdown copiado do editor continua sendo lido como markdown.
- Conversões encadeadas (HTML → markdown → destino) podem perder detalhes como tabelas complexas e cores; a perda é aceitável.
- Dependência nova (`htmd`); se a licença, a manutenção ou o tamanho não servirem, a decisão volta ao usuário antes de seguir.

## Estratégia de validação

- `npm run test:rust` (normalização: HTML com cada elemento, HTML sem formatação, texto do Chat, markdown com `**`, texto puro; comandos com e sem `format`), `npm run lint:rust`, `cargo fmt --check`.
- `npm run test`, `npm run build`, `npm run lint`.
- Instalador de teste em `releases/teste/` e validação manual no Windows (Marco).

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md` (Tela 2) e `docs/prototipo/picker.html`: botões de modo nas linhas de texto do Histórico.

Critério: os documentos descrevem o comportamento deste plano.

### Fase 2 — Normalização para markdown (backend)

- [x] Confirmar e adicionar `htmd`; extrair o fragmento do CF_HTML e convertê-lo quando tiver formatação.
- [x] Converter a sintaxe do Chat em markdown no texto sem HTML formatado.
- [x] Testes por caso da lista em Estratégia de validação.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Comandos (backend)

- [x] `paste_clipboard_item` e `copy_clipboard_item` com `format` opcional; sem ele, comportamento idêntico ao atual.

Critério: validações Rust passam.

### Fase 4 — Picker (frontend)

- [x] `api.ts` e `fakeApi.ts` com `format` nos comandos do Histórico.
- [x] Quatro botões de modo na linha de texto do Histórico selecionada; nenhum em imagens.
- [x] Testes Vitest.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 5 — Ajuda, documentação e instalador de teste

- [x] `src/helpContent.ts` (seções Modos de colagem e Histórico do clipboard) e `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

## Marco — Validação do usuário

- [x] `Enter`, clique e **Copiar** no Histórico continuam colando o original, com a formatação que veio junto.
- [x] Os quatro botões aparecem só na linha de texto selecionada do Histórico, não em imagens.
- [x] Markdown copiado de um editor de texto (ou do VS Code) colado como Google Chat, Sem formatação e Formatado sai certo.
- [x] Mensagem copiada da página do Google Chat colada como Formatado num e-mail (Gmail ou Outlook) mantém negrito, itálico, listas e links.
- [x] Texto escrito na sintaxe do Chat (`*negrito*`, `~tachado~`) colado como Formatado ou Markdown vira negrito e tachado.
- [x] Trecho formatado copiado do Gmail, do Word ou do Google Docs colado como Markdown ou Google Chat mantém a formatação na sintaxe certa.
- [x] O clipboard anterior continua sendo restaurado depois da colagem em todos os modos.

Validação técnica: `npm run test` (201), `npm run build`, `npm run lint`, `npm run test:rust` (158), `npm run lint:rust` e `cargo fmt --check` passaram. Dependência adicionada: `htmd` 0.5.6 (Apache-2.0). No HTML, `<b style="font-weight:normal">` (invólucro do Google Docs) não conta como negrito; negrito só por estilo em `<span>` não é reconhecido. Instalador de teste (inclui a Fase 5 do plano 081): `releases/teste/CSTM_0.15.0-teste-083-20261015-2331_x64-setup.exe`.

Resultado (2026-10-15): validado pelo usuário no Windows. Aceito.
