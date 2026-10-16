# 082 — Modos de colagem para markdown

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-15
- Concluído em: 2026-10-15

## Objetivo

Cadastrar textos em markdown padrão e escolher, na hora de colar pelo picker, como colá-los: sem formatação, markdown (fonte), formatado (rich text) ou na sintaxe do Google Chat.

## Contexto

- A colagem de textos cadastrados (`choose_snippet`, `copy_snippet` em `src-tauri/src/commands.rs`, `paste.rs`) escreve só texto puro no clipboard.
- `src-tauri/src/clipboard.rs` (plano 077) já escreve conteúdo com "HTML Format" do Windows, usado pelo Histórico.
- A linha selecionada do picker já mostra um botão Copiar (`src/Picker.tsx`, `PickerRow`).
- Preferências ficam na tabela `settings` (`src-tauri/src/db/settings.rs`) e aparecem na tela de Configurações (`src/components/SettingsPage.tsx`).
- Sintaxe oficial do Google Chat ([Ajuda do Google Chat](https://support.google.com/chat/answer/7649118)): `*negrito*`, `_itálico_`, `~tachado~`, `` `código` ``, bloco com ` ``` `, `>citação`, listas com `-` ou `*`. Não há sintaxe para títulos, links ou sublinhado.

## Decisões do usuário

- Quatro modos: Sem formatação, Markdown (fonte), Formatado (rich text) e Google Chat.
- O conteúdo é sempre guardado como markdown padrão; a conversão acontece só na colagem. Nada muda no editor.
- Todos os textos cadastrados oferecem os modos; não há campo novo no banco nem detecção automática.
- Enter ou clique na linha cola no modo padrão. Os outros modos são escolhidos só por botões na linha selecionada, sem atalhos de teclado novos.
- O modo padrão é uma configuração global nas Configurações, inicialmente Markdown (fonte), que preserva o comportamento atual.

## Escopo

### Incluído

- **Conversão (backend)**, com o parser `pulldown-cmark` (CommonMark + tachado e tabelas), em módulo próprio com funções puras e testes:
  - *Markdown (fonte)*: o conteúdo como está (comportamento atual).
  - *Sem formatação*: remove a marcação; preserva parágrafos e quebras de linha; listas viram `• item` (numeradas mantêm `1.`); links viram `texto (url)`, ou só a url quando iguais; blocos de código ficam sem as cercas.
  - *Formatado*: HTML gerado do markdown no "HTML Format" e o texto *Sem formatação* como `CF_UNICODETEXT` de reserva.
  - *Google Chat*: negrito `*`, itálico `_`, tachado `~`, código e blocos como no markdown, citação `>`, listas `-`; títulos viram linha em `*negrito*`; links viram `texto (url)`; tabelas viram linhas de texto com colunas separadas por ` | `.
- **Comandos**: `choose_snippet` e `copy_snippet` ganham `format` opcional (`plain` | `markdown` | `rich` | `chat`); sem ele, vale o padrão configurado. `src/api.ts` e `src/test/fakeApi.ts` acompanham.
- **Configuração**: `paste_format` em `settings` (padrão `markdown`), com get/set e um campo "Modo de colagem padrão" nas Configurações.
- **Picker**: na linha de texto selecionada, ao lado de Copiar, botões só de ícone, com dica, para os três modos que não são o padrão; o Copiar usa o modo padrão. Itens do Histórico não mudam. Os botões de modo ficam por cima do fim da linha selecionada (sobre a pasta e o fim do título), para as linhas não mudarem de altura ao navegar; o título inteiro continua na dica.
- **Restauração do clipboard**: mantém a regra de 500 ms (p60), comparando pelo número de sequência como hoje, também quando houver HTML.
- Desenho (`docs/telas.md`, `docs/prototipo/picker.html`), Ajuda (`src/helpContent.ts`) e testes Rust e Vitest.

### Fora do escopo

- Editor com pré-visualização ou conversão do conteúdo entre markdown e Google Chat.
- Modos para itens do Histórico do clipboard.
- Atalhos de teclado para os modos.
- RTF no modo Formatado (HTML cobre Word, Outlook, Gmail e Teams).

## Estado desejado

Um texto em markdown cadastrado uma vez pode ser colado como fonte, texto limpo, rich text ou no formato do Google Chat, com dois cliques no máximo.

## Riscos e premissas

- Textos comuns com `*`, `_` ou `#` literais podem ser alterados nos modos convertidos; por isso o padrão inicial é Markdown (fonte), que não converte.
- Converter para Google Chat perde o que ele não suporta (títulos, links com texto, tabelas, listas aninhadas profundas); a perda é previsível e descrita na Ajuda.
- Aninhar negrito e itálico no Google Chat (`*_texto_*`) precisa de teste real; marcadores colados no meio de palavras podem não ser interpretados.
- Destinos diferentes tratam HTML colado de formas diferentes; validar ao menos Word ou Outlook, Gmail e Google Chat.
- Dependência nova: `pulldown-cmark` em `src-tauri/Cargo.toml`, com `Cargo.lock` atualizado.
- Quatro botões na linha selecionada dependem das colunas mais largas do plano 081; se o 082 for executado antes, conferir o espaço disponível.

## Estratégia de validação

- `npm run test:rust` (conversões com exemplos de cada elemento markdown), `npm run lint:rust`, `cargo fmt --check`.
- `npm run test`, `npm run build`, `npm run lint`.
- Validação manual no Windows colando em aplicativos reais (Marco).

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md` (Tela 2 e Configurações) e `docs/prototipo/picker.html`: botões de modo na linha selecionada e campo de modo padrão.

Critério: os documentos descrevem o comportamento deste plano.

### Fase 2 — Conversões (backend)

- [x] Adicionar `pulldown-cmark`; módulo de conversão com os quatro modos e testes por elemento (ênfases, código, citação, listas, títulos, links, tabelas, quebras de linha).

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Comandos e configuração (backend)

- [x] `paste_format` em `settings` com get/set e testes.
- [x] `choose_snippet` e `copy_snippet` com `format` opcional, escrevendo texto ou HTML + texto conforme o modo.

Critério: validações Rust passam e a colagem sem `format` continua idêntica com o padrão inicial.

### Fase 4 — Picker e Configurações (frontend)

- [x] `api.ts` e `fakeApi.ts` com `format` e `get/setPasteFormat`.
- [x] Botões de modo na linha selecionada, ocultando o modo padrão.
- [x] Campo "Modo de colagem padrão" nas Configurações.
- [x] Testes Vitest dos botões e da configuração.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 5 — Ajuda, documentação e instalador de teste

- [x] `src/helpContent.ts`: modos de colagem, configuração e limitações do Google Chat; `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

## Marco — Validação do usuário

- [x] Com o padrão inicial, Enter cola o texto exatamente como antes.
- [x] Os botões aparecem só na linha de texto selecionada, com dicas claras, e não aparecem no Histórico.
- [x] Sem formatação: o texto chega limpo (sem `*`, `#`, cercas), com parágrafos e listas legíveis.
- [x] Formatado: negrito, itálico, listas, títulos, links e código aparecem formatados no Word ou Outlook e no Gmail.
- [x] Google Chat: colado e enviado no Google Chat, negrito, itálico, tachado, código, bloco de código, citação e listas aparecem formatados.
- [x] Mudar o modo padrão nas Configurações muda o que Enter e Copiar fazem, e os botões passam a mostrar os outros três modos.
- [x] O clipboard anterior continua sendo restaurado depois da colagem em todos os modos.

Validação técnica: `npm run test` (199), `npm run build`, `npm run lint`, `npm run test:rust` (151), `npm run lint:rust` e `cargo fmt --check` passaram. Instalador de teste (o mesmo para os planos 080, 081 e 082): `releases/teste/CSTM_0.15.0-teste-080-081-082-20261015-1817_x64-setup.exe`. Os botões de modo ficam por cima do fim da linha selecionada; conferir se a sobreposição fica aceitável. Pressupostos a confirmar: modos só para textos cadastrados (não para o Histórico), Copiar usa o modo padrão, Formatado sem RTF.

Resultado (2026-10-15): validado pelo usuário no Windows. Aceito. Os modos para itens do Histórico, fora deste escopo, ficam para o plano 083.
