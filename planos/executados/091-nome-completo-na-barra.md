# 091 — Nome completo na barra inferior

- **Status:** Concluído
- **Prioridade:** Baixa
- **Criado em:** 2026-10-20
- **Concluído em:** 2026-10-20

## Objetivo

Mostrar o que a sigla CSTM significa onde a pessoa usa o aplicativo: na barra inferior do cadastro e na introdução da Ajuda. Hoje o nome completo só aparece na página Sobre e no README.

## Contexto

- A barra inferior (`src/components/StatusBar.tsx`) mostra o estado do salvamento à esquerda, os totais e a versão (`v0.21.0`) à direita. A mensagem de estado é cortada com reticências quando falta espaço.
- A janela `main` abre com 1000 px de largura e aceita até 760 px (`tauri.conf.json`).
- A introdução da Ajuda (`HELP_INTRO` em `src/helpContent.ts`) diz "O CSTM salva textos…", sem explicar a sigla.

## Decisões tomadas com o usuário

- Formato na barra: `CSTM — Clipboard, Snippets & Text Manager · v0.21.0`, em cinza e só informativo, no lugar de `v0.21.0`.
- Em janela estreita, o nome por extenso some e a barra mostra `CSTM · v0.21.0`; a mensagem de salvamento mantém o espaço. O limite é 1000 px de largura da janela (o tamanho padrão mostra o nome completo).
- A introdução da Ajuda passa a explicar a sigla: "O CSTM (Clipboard, Snippets & Text Manager) salva textos…".

## Escopo

- `src/components/StatusBar.tsx` e o teste da versão em `src/App.test.tsx`.
- `src/helpContent.ts` (introdução) e testes que dependam desse texto.
- Protótipos com a barra: `docs/prototipo/cadastro.html`, `ajuda.html`, `configuracoes.html`, `sobre.html`.
- Imagens da Ajuda que mostram a barra: `basico-2-titulo-conteudo` e `avancado-lixeira`.
- `docs/telas.md` (linha "Barra inferior") e `CHANGELOG.md`.

Fora do escopo: título das janelas, bandeja, página Sobre e README, que já estão como devem ficar.

## Estado desejado

- Com a janela a partir de 1000 px de largura, a barra termina com `CSTM — Clipboard, Snippets & Text Manager · v0.21.0`; abaixo disso, com `CSTM · v0.21.0`.
- Antes de a versão carregar (ou fora do Tauri), a barra mostra só a parte do nome, sem versão.
- A Ajuda explica a sigla na introdução.

## Riscos e premissas

- Com mensagens de estado longas (erro ao salvar, "Não salvo: …") e a janela perto de 1000 px, a mensagem pode ser cortada mais cedo que hoje. Risco aceito: o limite mantém a regra atual de corte da mensagem.
- jsdom não aplica media queries; o teste confere o texto e a validação da troca por largura fica no Marco.

## Estratégia de validação

`npm run test`, `npm run build` e `npm run lint`; conferência das imagens regeneradas; verificação visual no Windows no Marco.

## Fase 1 — Barra inferior e Ajuda

- [x] `StatusBar` mostra "CSTM", o nome por extenso (escondido abaixo de 1000 px de largura) e a versão, separados como nas decisões.
- [x] Teste da barra confere a sigla, o nome completo e a versão.
- [x] `HELP_INTRO` explica a sigla; testes afetados atualizados.
- [x] Critério: `npm run test`, `npm run build` e `npm run lint` sem erros.

## Fase 2 — Protótipos e imagens da Ajuda

- [x] Barra dos quatro protótipos com o novo texto.
- [x] `npm run ajuda:imagens basico-2-titulo-conteudo avancado-lixeira` executado e imagens conferidas.
- [x] Critério: as duas imagens mostram o nome completo na barra, sem outra diferença visual.

## Fase 3 — Documentação

- [x] `docs/telas.md`: linha "Barra inferior" descreve o nome, a versão e a troca por largura.
- [x] `CHANGELOG.md`: entrada em `Changed` sob `[Unreleased]`.
- [x] Critério: documentos coerentes com o comportamento implementado.

## Fase 4 — Instalador de teste

- [x] `npm run tauri -- build --config '{"version":"0.22.0-teste-091"}'` e cópia para `releases/teste/CSTM_0.22.0-teste-091_x64-setup.exe`.
- [x] Critério: build sem erros e instalador presente em `releases/teste/`.

## Marco — Validação do usuário

- [x] Instalar `releases/teste/CSTM_0.22.0-teste-091_x64-setup.exe` por cima da versão atual.
- [x] Abrir o cadastro no Windows no tamanho padrão: a barra termina com `CSTM — Clipboard, Snippets & Text Manager · v<versão>`.
- [x] Estreitar a janela abaixo de 1000 px: a barra passa a `CSTM · v<versão>` e a mensagem de salvamento continua legível.
- [x] Abrir a Ajuda (`F1`): a introdução explica a sigla.
- [x] Aceite do usuário: validado em 2026-10-20.
