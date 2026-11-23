# 098 — Altura da coluna principal do menu pelo conteúdo

- Status: Concluído
- Concluído em: 2026-11-23
- Prioridade: Média
- Criado em: 2026-11-23
- Issue: #4

## Objetivo

A coluna principal do menu de colagem cresce na vertical conforme o conteúdo, até a altura da área útil, para mostrar mais itens sem rolagem.

## Contexto

A issue #4 fala em "janela principal", mas o usuário esclareceu que trata do menu de colagem (picker). Hoje a coluna principal tem altura fixa de 440 (`picker::HEIGHT`), em modo clique e cascata, e rola por dentro. No print do usuário, com a biblioteca de teste importada, a raiz corta no meio de "Pasta com nome bem longo…" e esconde o restante, mesmo com a tela sobrando. As subcolunas já crescem pelo conteúdo até a borda inferior da área útil (`cascade::arrange`, regra 7 de `docs/telas.md`).

Dados de teste: `releases/teste/CSTM-dados-de-teste.json` (49 pastas e 237 textos, incluindo uma pasta com 100 textos), fora do Git.

## Decisões com o usuário

- Altura máxima: a altura da área útil inteira (sem a barra de tarefas). A rolagem só aparece quando a coluna chega a esse limite.
- Altura mínima: 440, a de hoje. A coluna nunca fica menor, mesmo com pouco conteúdo ou numa busca com poucos resultados.
- Com o menu aberto, a altura acompanha o conteúdo (ao entrar numa pasta no modo clique e ao buscar), com o topo fixo. Se não couber abaixo, a coluna sobe só o necessário para caber na área útil.
- Na abertura, a regra de posição continua: junto ao cursor, empurrada para caber na área útil.
- Detalhe do orquestrador: depois de subir, o topo não volta a descer enquanto o menu está aberto (encolher não move a coluna). Na próxima abertura vale de novo a posição junto ao cursor.
- A largura (420) e as subcolunas não mudam. As subcolunas continuam abrindo com o topo no da coluna principal.

## Contrato

- `layout_picker` recebe também `mainContentHeight` (altura lógica do conteúdo da coluna principal sem rolagem: busca, linha de volta, lista e rodapé). O backend calcula a altura da principal como `clamp(mainContentHeight, 440, altura da área útil)`, sobe o topo se a coluna passar da borda inferior, guarda a nova posição da principal na abertura atual e devolve as colunas como hoje (a principal primeiro).
- Função pura em Rust para essa conta, com testes (escala 100% e 150%, área com origem não zero).
- O frontend mede a altura natural do conteúdo da coluna principal e pede um layout sempre que ela muda (inclusive na abertura, antes do aviso de pronto quando possível), usando a mesma fila de pedidos (`requestLayout`) das subcolunas e do preview.

## Escopo

- `src-tauri/src/picker.rs` (e `commands.rs` na assinatura do comando); `cascade.rs` só se necessário.
- `src/Picker.tsx`, `src/api.ts`, `src/test/fakeApi.ts` e testes Vitest do menu.
- `e2e/app/picker.spec.ts`: a coluna principal cresce com muitos itens na raiz.
- `docs/telas.md` (Tela 2: tamanho da coluna e regras da cascata), `CHANGELOG.md`. A Ajuda não cita a altura do menu; o protótipo `docs/prototipo/picker.html` continua com 440, que é o mínimo, e as imagens da Ajuda não mudam.
- Versão 1.1.4 (PATCH), depois da 1.1.3 do plano 097; instalador de teste `1.1.4-teste-098`, que inclui também as mudanças do 097.

## Riscos e premissas

- Medir a altura no WebView pode oscilar se o tamanho depender da própria altura; mede-se o conteúdo natural da lista (`scrollHeight`), que não depende da altura da coluna.
- Pedidos de layout seguidos (digitar na busca) usam a numeração existente: só a resposta mais nova vale.
- Mudança de comportamento do menu exige validação funcional no Windows (Marco); `npm run test:windows` só com autorização.

## Fase 1 — Backend

- [x] Altura e posição da coluna principal pelo conteúdo em `layout_picker`, com testes Rust (`picker::fit_main_height`, 7 testes).
- Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam. ✔ 210 testes Rust, clippy e fmt limpos.

## Fase 2 — Frontend e testes

- [x] Medição da coluna principal e pedido de layout quando ela muda; `fakeApi` com a mesma regra.
- [x] Testes Vitest e um teste em `e2e/app/picker.spec.ts`.
- Critério: `npm run lint`, `npm run build`, `npm run test`, `npm run e2e:build` passam; `npm run test:app` só com autorização do usuário (regra de 2026-11-23). ✔ lint, build, Vitest 299 e e2e:build. O subagente rodou `test:app` uma vez antes de receber a regra nova (83 passando, 4 adiados, incluindo o teste novo); o teste e2e confere a altura pedida ao backend, não o limite pela área útil, que fica coberto pelos testes Rust.

## Fase 3 — Documentação, versão e instalador de teste

- [x] `docs/telas.md` e `CHANGELOG.md` (Unreleased).
- [x] Instalador `1.1.4-teste-098` em `releases/teste/` (`CSTM_1.1.4-teste-098_x64-setup.exe`, 4,03 MiB), com as mudanças do 097.
- Critério: instalador gerado.

## Marco — Validação do usuário

- [x] Com a biblioteca de teste, a coluna principal mostra a raiz inteira sem rolagem (se couber na tela).
- [x] Com o cursor perto do fim da tela, a coluna alta sobe o necessário e não passa da barra de tarefas.
- [x] Modo clique: entrar em "Lorem ipsum (100 textos)" faz a coluna crescer até a área útil e rolar; voltar à raiz ajusta a altura sem mover o topo.
- [x] Busca com poucos resultados: a coluna fica com 440.
- [x] Modo cascata: as subcolunas continuam abrindo ao lado, com o topo no da principal.
- [x] Monitor com escala diferente de 100%, se houver.

Resultados: o usuário validou as verificações com o instalador de teste em 2026-11-23.

Aceite: "aprovados" (usuário, 2026-11-23).
