# p30 — Tela de cadastro

## Objetivo

Implementar a tela de cadastro na janela `main` — árvore única de pastas e textos, editor sempre aberto com salvamento automático, busca e favoritos — sobre comandos Tauri que expõem o módulo `db`.

## Contexto

O módulo `db` (p20) implementa todas as operações de pastas e textos com testes. Corresponde à etapa 3 de `docs/mvp.md`. A primeira versão da tela (fases 1–6, três colunas com botão Salvar) foi implementada e reprovada no uso; o desenho aprovado em substituição é o conceito C refinado de `docs/telas.md` (seção v2), com protótipo em `docs/prototipo/cadastro.html`.

## Escopo

### Backend

- `Serialize` em `Folder` e `Snippet`, com campos em camelCase (`parentId`, `folderId`, `useCount`, `lastUsedAt`, `sortOrder`, `createdAt`, `updatedAt`).
- Módulo `commands` com comandos finos que delegam ao `db`:
  - pastas: `list_folders`, `create_folder`, `rename_folder`, `delete_folder`, `move_folder`;
  - textos: `list_snippets`, `list_all_snippets`, `list_favorites`, `search_snippets`, `create_snippet`, `update_snippet`, `set_favorite`, `delete_snippet`, `move_snippet`.
- `list_all_snippets`: nova função no `db` que lista todos os textos na ordem de pasta e `sort_order`, para montar a árvore numa só chamada. Sem mudança de esquema nem das regras do p20.
- Erros dos comandos como `String` com a mensagem em português do `DbError`.
- `record_use` não é exposto (p60). Funções sem uso fora dos testes recebem `expect` próprio com o motivo.
- Capability `core:window:allow-destroy` na janela `main`, necessária para fechar a janela depois de interceptar o pedido de fechamento.

### Frontend

- React com Fluent UI React v9 e `@fluentui/react-icons`; sem biblioteca de estado. O tema acompanha o claro/escuro do sistema. Visual ajustado ao protótipo com `makeStyles` e tokens.
- `src/api.ts` continua o único ponto de acesso ao backend.
- Layout em duas colunas com divisor arrastável (220–480 px) e barra inferior, conforme `docs/telas.md` (v2):
  - árvore única: pastas primeiro e depois textos, cada grupo na ordem manual; textos sem pasta na raiz; ícones distintos para pasta aberta, fechada e texto; estrela nos favoritos; marcação de pendente, rascunho, inválido e erro;
  - editor de texto: caminho da pasta no topo (partes clicáveis), estrela e `...`; título grande e conteúdo editáveis diretamente, sem rótulos nem caixas;
  - editor de pasta: nome editável como título, contagem de textos e subpastas, atalhos "Novo texto aqui" e "Nova subpasta";
  - barra inferior: estado do salvamento e totais de textos e pastas.
- Criação por um botão `+ Novo` com menu (Novo texto `Ctrl+N`, Nova pasta `Ctrl+Shift+N`), indicando o destino: pasta selecionada, pasta do texto selecionado ou raiz. Nova pasta entra na árvore com o nome em edição (Enter grava, Esc cancela). Itens novos entram no fim do grupo.
- Menu de contexto por `...` ou clique direito: Renomear (`F2`), Mover para… (`Ctrl+M`, diálogo com a árvore de pastas), Mover para cima/baixo (`Alt+↑`/`Alt+↓`), Adicionar/Remover dos favoritos (textos) e Excluir (`Del`).
- Exclusão com diálogo modal que informa o que vai junto (subpastas, textos, favoritos).
- Salvamento automático, conforme as regras de `docs/telas.md`:
  - grava após 800 ms sem digitar, ao trocar de item, quando a janela perde o foco e em `Ctrl+S`;
  - só grava título e conteúdo não vazios; rascunho novo é criado no banco na primeira gravação válida;
  - rascunho inválido e gravação com erro ficam preservados em memória, marcados na árvore, mesmo ao trocar de item; rascunho novo vazio é descartado ao sair dele;
  - uma gravação por texto de cada vez; edições durante a gravação disparam outra ao terminar;
  - erro mostra a mensagem com "Tentar novamente"; nada é descartado;
  - fechar a janela com pendências pede confirmação.
- Favoritos como filtro da árvore, mantendo as pastas onde estão.
- Busca integrada à árvore, com espera de 200 ms: mantém as pastas que contêm resultados (abertas), destaca o termo, mostra trecho quando a correspondência é só no conteúdo e exibe a contagem. Limpar restaura a árvore.
- Primeiro uso: chamada na árvore e apresentação em três passos no editor.
- Largura da árvore e pastas recolhidas guardadas no `localStorage` do WebView.
- Erros que não são de gravação em `MessageBar` dispensável.
- Janela `main` com 1000×650 e mínimo de 760×480.

### Testes de frontend

- Vitest com jsdom e Testing Library; script `npm run test`. `api.ts` é substituído por `src/test/fakeApi.ts` nos testes.

Fora do escopo: arrastar e soltar, persistência de rascunhos inválidos entre execuções, bandeja, picker, colagem e contador de uso.

## Estado desejado

- A janela `main` permite todas as operações de cadastro do MVP no desenho aprovado, com persistência no banco do p20 e sem perda de edições.
- O frontend acessa os dados somente pelos comandos Tauri.
- Há testes automatizados de backend para o contrato dos comandos e de frontend para os fluxos principais.

## Premissas

- Recarregar pastas e textos após cada operação estrutural é suficiente para o volume do MVP; a gravação automática atualiza só o texto gravado.
- Os argumentos dos comandos chegam do frontend em camelCase, convertidos pelo Tauri para os parâmetros snake_case em Rust.
- Até o p40, fechar a janela encerra o aplicativo; com o p40 passa a ocultá-la, e a confirmação de pendências se aplica ao encerramento pela bandeja.

## Riscos

- O `Tree` do Fluent pode não acomodar bem itens mistos, edição de nome no lugar e menu de contexto; nesse caso a árvore usa lista própria com papéis ARIA de árvore e o visual do Fluent.
- Gravação automática com várias pendências pode gerar corrida entre resposta do backend e nova edição; a fila por texto e testes com relógio simulado cobrem o caso.
- Destacar o termo e montar o trecho no frontend precisam ignorar acentos como o FTS5; a correspondência aproximada no frontend pode diferir em casos raros (o resultado continua vindo do backend).
- Interceptar o fechamento da janela depende de permissão do Tauri; sem ela o aplicativo não fecha. Validar manualmente no Windows.
- Testes com `api.ts` simulado não cobrem a integração real com o Tauri; ela é coberta pela validação manual.
- O Fluent UI deixa o JavaScript do build acima de 500 kB (aviso do Vite).

## Estratégia de validação

- Automática: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`.
- Testes Rust: serialização em camelCase, conversão de erros e ordem de `list_all_snippets`.
- Testes de frontend: montagem da árvore mista; criar texto e pasta pelo `+ Novo` no destino certo; salvamento automático após a pausa, ao trocar de item e com `Ctrl+S` (relógio simulado); rascunho inválido preservado e marcado; erro com nova tentativa; menu de contexto (renomear, mover, subir/descer, favoritar, excluir com confirmação); busca preservando a hierarquia; filtro de favoritos.
- Manual no Windows (`npm run tauri -- dev`): roteiro com todas as operações, salvamento automático, confirmação ao fechar com pendências, preferências mantidas e persistência após reiniciar o aplicativo.

## Fases

### Fase 1 — Comandos Tauri

- [x] `Serialize` em camelCase em `Folder` e `Snippet`.
- [x] Módulo `commands` registrado no `invoke_handler`.
- [x] Remover o `#[expect(dead_code)]` amplo de `mod db`.
- [x] Testes de serialização e conversão de erros.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 2 — Infraestrutura de frontend

- [x] Vitest, jsdom e Testing Library; script `npm run test`.
- [x] `src/api.ts` com tipos e funções dos comandos.
- [x] Layout inicial e tamanho da janela.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 3 — Pastas

- [x] Árvore de pastas, seleção, criar, renomear, excluir com confirmação, subir/descer e mover.
- [x] Testes da montagem da árvore e da confirmação de exclusão.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Textos e favoritos

- [x] Lista, editor, rascunho, salvar (`Ctrl+S`), excluir com confirmação, favoritar, subir/descer e mover.
- [x] Aviso de descarte de alterações não salvas.
- [x] Testes de criação, validação, favoritar, exclusão e descarte.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 5 — Busca e documentação

- [x] Busca com espera e resultados de todas as pastas.
- [x] Teste da busca.
- [x] Atualizar `README.md`, `AGENTS.md` e `CHANGELOG.md`.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 6 — Interface com Fluent UI

- [x] Instalar `@fluentui/react-components` e `@fluentui/react-icons`.
- [x] `FluentProvider` com tema claro/escuro do sistema.
- [x] Reescrever barra lateral, árvore, lista, editor, confirmações e erros com componentes do Fluent.
- [x] Ajustar os seletores dos testes, preservando os cenários.
- [x] Atualizar `CHANGELOG.md`.

Critério: todas as validações automáticas passam e o tamanho do build é registrado.

Tamanho do build: JavaScript de 642 kB (178 kB gzip) com Fluent UI, ante 232 kB (72 kB gzip) com CSS próprio; o Vite emite aviso de bloco acima de 500 kB.

### Fase 7 — Conceito C: árvore única e salvamento automático

Substitui o layout e o fluxo de edição das fases 2–6, que deixam de valer onde conflitam com o escopo acima.

- [x] Backend: `list_all_snippets` no `db` e em `commands`, com teste; capability `core:window:allow-destroy`.
- [x] `fakeApi` e `api.ts` com `listAllSnippets`.
- [x] Lógica pura e testada: árvore mista, filtro de busca e de favoritos preservando a hierarquia, destino de criação.
- [x] Salvamento automático: estados, pausa de 800 ms, fila por texto, rascunhos em memória, erro com nova tentativa.
- [x] Layout de duas colunas com divisor, barra inferior e preferências no `localStorage`.
- [x] Árvore com seleção, abrir/fechar, marcações de estado e edição de nome no lugar.
- [x] `+ Novo`, menu de contexto, atalhos de teclado e diálogo "Mover para…".
- [x] Editor de texto, editor de pasta e primeiro uso.
- [x] Confirmação de exclusão detalhada e confirmação ao fechar com pendências.
- [x] Remover componentes e testes substituídos; reescrever os testes de frontend.
- [x] Atualizar `README.md`, `AGENTS.md` (referência a `docs/telas.md` e ao protótipo) e `CHANGELOG.md`.

Critério: todas as validações automáticas passam, o tamanho do build é registrado e o roteiro manual no Windows é aprovado.

Implementação: a árvore é uma lista própria com papéis ARIA de árvore (`tree`/`treeitem` com `aria-level` e `aria-activedescendant`), não o `Tree` do Fluent; o salvamento automático fica em `src/drafts.ts` (`DraftStore`), fora do React. Tamanho do build: JavaScript de 687 kB (193 kB gzip). Validações automáticas e roteiro manual no Windows aprovados.
