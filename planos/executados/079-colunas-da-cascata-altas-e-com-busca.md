# 079 — Colunas da cascata altas e com busca própria

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Deixar as colunas extras do menu em cascata (subcolunas) mais úteis em pastas grandes, como o Histórico com 100 itens:

- **Altura:** toda subcoluna começa na altura do topo da coluna principal e desce até a borda inferior da área útil (a barra de tarefas ou a borda da tela). Termina antes se o conteúdo for menor e rola por dentro se for maior.
- **Busca da coluna:** cada subcoluna ganha um campo de busca próprio, sempre visível no topo, que filtra só a partir daquela pasta.

## Contexto

- Hoje a subcoluna nasce alinhada à pasta que a abriu e tem a altura do conteúdo. Se passar da borda inferior, sobe o necessário. Se for maior que a área útil, ocupa a altura inteira dela (`src-tauri/src/cascade.rs`, `arrange`; `docs/telas.md`, Tela 2, Navegação nas pastas, regra 7). Com o Histórico cheio, a coluna cobre a tela de cima a baixo e perde a ligação visual com o menu.
- As subcolunas não têm campo de busca nem rodapé (regra 1). O teclado fica sempre no campo de busca da coluna principal: as linhas evitam tirar o foco dele (`onMouseDown` com `preventDefault`), e `↑`/`↓`/`→`/`←` agem sobre a coluna ativa (`activeColumn`).
- A busca da coluna principal vale para toda a biblioteca, só sobre textos cadastrados, pelo comando `search_snippets` (FTS5, prefixo, sem acento nem caixa, todos os termos exigidos, títulos primeiro). Com texto nela, as subcolunas se fecham (regra 5).
- O Histórico chega ao picker já carregado (`list_clipboard_history`), com `title` e `preview` (até 500 caracteres) de cada item.

## Decisões do usuário

- A subcoluna começa no topo da coluna principal e desce até bater na barra de tarefas ou na borda da tela, com rolagem quando o conteúdo não couber. Não há teto pela altura da coluna principal.
- O campo de busca da coluna é sempre visível, em toda subcoluna.
- O filtro vale para a pasta e todas as subpastas dela.
- Entrar numa coluna pelo teclado leva o foco para o campo dela.
- Nos resultados do filtro, só os textos de subpastas mostram a pasta à direita.
- `Esc` continua fechando o menu; o filtro é limpo pelo botão ✕ do campo (ou apagando o texto).

## Escopo

### Incluído

- **Posição vertical das subcolunas** (vale para todas, em qualquer nível):
  - topo = topo da coluna principal (mesmo se ela estiver fora de vista por causa de uma coluna encostada à direita);
  - altura = a do conteúdo, limitada pelo espaço entre esse topo e a borda inferior da área útil;
  - rolagem interna quando o conteúdo não cabe; `↑`/`↓` rolam até a linha selecionada (já é assim).
  - Como a coluna principal sempre cabe na área útil, esse espaço é no mínimo a altura dela; não há caso de espaço insuficiente.
  - A pasta que abriu a coluna continua realçada, que é o que liga as duas colunas.
- **Campo de busca nas subcolunas:**
  - campo compacto no topo de cada subcoluna, com ícone de lupa, placeholder "Buscar em <nome da pasta>" e botão ✕ quando tem texto; a lista fica abaixo, com rolagem;
  - a altura do campo entra na altura do conteúdo enviada ao backend (`contentHeight`), e a regra de posição horizontal não muda.
- **O que o filtro encontra:**
  - **pasta real:** os textos da pasta e de todas as subpastas dela, pela mesma regra da busca principal (prefixo, sem acento nem caixa, todos os termos, títulos primeiro). Pastas não aparecem nos resultados, como na busca principal. Cada resultado mostra à direita a pasta em que está, quando não for a própria pasta da coluna, e o caminho completo na dica;
  - **Favoritos e Mais usados:** os textos da lista que batem com a busca, na ordem de relevância;
  - **Histórico:** os itens cujo título ou prévia contém todos os termos (sem acento nem caixa, por prefixo de palavra), na ordem do Histórico; imagens batem com "imagem" pelo título "Imagem L × A".
  - Sem resultados: "Nenhum texto encontrado."
- **Interação:**
  - clicar no campo de uma subcoluna leva o foco do teclado para ele e torna a coluna ativa;
  - entrar numa subcoluna pelo teclado (`→` ou `Enter` numa pasta) leva o foco para o campo dela, então digitar filtra a coluna; `←` (com o campo vazio) fecha a coluna e devolve o foco ao campo da coluna anterior;
  - passar o mouse não move o foco;
  - digitar no campo de uma coluna fecha as colunas à direita dela e seleciona o primeiro resultado;
  - no campo de uma subcoluna, `↑`/`↓`, `Home`/`End`, `Enter`, `Ctrl+C`, `→`/`←` e `Esc` agem como no campo principal: as setas laterais só navegam com o campo vazio, e `Esc` fecha o menu;
  - nos resultados filtrados não há pastas, então `→` não abre coluna;
  - o filtro dura enquanto a coluna estiver aberta. Trocar a pasta da coluna, fechá-la ou reabrir o menu descarta o filtro;
  - digitar na busca principal continua fechando todas as subcolunas.
- **Backend:** `search_snippets` ganha o parâmetro opcional `folderId`. Com ele, a busca se restringe à pasta e às subpastas (CTE recursiva sobre `folders`); sem ele, nada muda. O comando, `src/api.ts` e `src/test/fakeApi.ts` acompanham.
- **Testes:**
  - Rust: posição vertical em `cascade.rs`, cobrindo topo no da principal, altura limitada pela borda, conteúdo curto, subcoluna de segundo nível, principal escondida e área útil fora da origem; busca com `folderId`, cobrindo subpastas, pasta irmã fora, raiz e lixeira fora;
  - Vitest: campo visível na subcoluna, filtro em pasta real, em Favoritos e no Histórico, foco ao entrar pelo teclado, `←` devolvendo o foco, colunas à direita fechando ao filtrar, ✕ limpando, `Esc` fechando e "Nenhum texto encontrado.".
- **Documentação:**
  - `docs/telas.md`: Tela 2, Navegação nas pastas, regras 1, 4, 5 e 7 e o desenho esquemático;
  - `docs/prototipo/picker.html`: campo nas subcolunas e a nova posição vertical;
  - Ajuda (`src/helpContent.ts`), na seção de busca;
  - `CHANGELOG.md`.

### Fora do escopo

- Busca no modo "Clicar para abrir" além da principal (lá não há subcolunas).
- Incluir o Histórico na busca da coluna principal.
- Mudar a busca principal, a largura das colunas ou a posição horizontal.

## Estado desejado

Com o Histórico cheio e o menu aberto perto do rodapé, a coluna do Histórico ocupa do topo da coluna principal até a barra de tarefas e rola por dentro. Digitar "reunião" no campo dela mostra só os itens com essa palavra. Numa pasta "Trabalho" com subpastas, o campo encontra textos de "Trabalho › E-mails" sem sair da coluna.

## Riscos e premissas

- **Foco fora do campo principal:** hoje todo o teclado assume o campo principal (`inputRef`, `aria-activedescendant`). Levar o foco a outro campo exige que cada campo aponte para a própria lista e que o fluxo de abertura (foco no campo principal) continue igual. Os testes de teclado existentes são o contrato a preservar.
- **Alturas maiores:** colunas mais altas aumentam a região recortada da janela. A regra de recorte não muda, mas a ausência de cintilação na cascata precisa de validação no Windows.
- **Filtro do Histórico no frontend:** a prévia é encurtada em 500 caracteres, então um termo que só aparece depois disso não é encontrado. Isso é aceitável para o menu e fica registrado em `docs/telas.md`.
- **Premissa:** a coluna principal sempre cabe na área útil (hoje garantido por `picker.rs`).

## Estratégia de validação

`npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check`. Instalador de teste em `releases/teste/` para o Marco. A validação funcional no Windows fica a cargo do usuário.

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md`: atualizar as regras 1, 4, 5 e 7 da Navegação nas pastas e o desenho esquemático (campo na subcoluna, topo no da principal).
- [x] `docs/prototipo/picker.html`: campo nas subcolunas e a nova posição vertical.

Critério: os dois documentos descrevem o mesmo comportamento deste plano, sem a regra antiga de alinhar a subcoluna à pasta.

### Fase 2 — Geometria (backend)

- [x] `cascade.rs`: topo da subcoluna no topo da principal e altura limitada pela borda inferior da área útil; atualizar a documentação de `arrange`, de `Subcolumn::anchor_y` (sem uso, então remover do contrato) e os testes afetados.
- [x] Se `anchorY` sair do contrato, ajustar `layout_picker`, `src/api.ts`, `src/test/fakeApi.ts` e a chamada em `Picker.tsx`.

Critério: `npm run test:rust` e `npm run lint:rust` passam, com testes novos para os casos listados no escopo.

### Fase 3 — Busca restrita a uma pasta (backend)

- [x] `search_snippets` com `folder_id: Option<i64>` (pasta e subpastas, fora da lixeira); comando e `api.ts`/`fakeApi.ts` com `folderId` opcional.

Critério: testes Rust da busca com e sem pasta passam, e a busca principal continua idêntica.

### Fase 4 — Campo e filtro nas subcolunas (frontend)

- [x] Campo no topo de cada subcoluna, com placeholder, ✕ e altura incluída em `contentHeight`.
- [x] Filtro por coluna: pasta real pelo backend, Favoritos e Mais usados pela interseção com a busca, Histórico pelo filtro local.
- [x] Foco e teclado por coluna, conforme a seção Interação.
- [x] Testes Vitest do escopo; os testes existentes continuam passando sem alterar expectativas, exceto as que descrevem a posição vertical antiga.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 5 — Ajuda, documentação e instalador de teste

- [x] `src/helpContent.ts`: mencionar a busca dentro das colunas.
- [x] `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

## Marco — Validação do usuário

- [x] Com o Histórico cheio, a coluna dele começa no topo da coluna principal, desce até a barra de tarefas e rola por dentro, com o menu aberto no alto e perto do rodapé da tela.
- [x] Uma pasta pequena abre uma coluna curta, com o topo no da coluna principal.
- [x] Uma subcoluna de segundo nível segue a mesma regra.
- [x] O campo da coluna filtra o Histórico, Favoritos e uma pasta com subpastas, mostrando a pasta de cada resultado.
- [x] `→` numa pasta entra na coluna com o foco no campo dela; digitar filtra; `←` volta à coluna anterior.
- [x] O ✕ limpa o filtro e `Esc` fecha o menu.
- [x] Abrir e fechar colunas continua sem piscar.
- [x] A altura da subcoluna é calculada ao abrir, pelo conteúdo da pasta, e não muda ao filtrar. Conferir se uma pasta pequena com muitos resultados nas subpastas fica aceitável (rola por dentro).
- [x] A altura do campo de busca da subcoluna (41 px estimados) não deixa sobra nem corte no fim da lista.

Validação técnica: `npm run test` (190), `npm run build`, `npm run lint`, `npm run test:rust` (118), `npm run lint:rust` e `cargo fmt --check` passaram. Instalador de teste: `releases/teste/CSTM_0.14.0-teste-079-20261014-2217_x64-setup.exe`.

Resultado: aprovado pelo usuário em 2026-10-14.
