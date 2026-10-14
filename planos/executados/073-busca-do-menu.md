# 073 — Busca do menu de colagem

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Corrigir dois defeitos da busca no menu de colagem: títulos longos que quebram em duas linhas e invadem as linhas vizinhas, e a ordem dos resultados, que pode colocar textos encontrados só pelo conteúdo acima de textos cujo título contém o termo buscado.

## Contexto

- As linhas do menu (`src/Picker.tsx`) têm altura fixa de 32 px (`ROW_HEIGHT`) e `whiteSpace: "nowrap"`, mas o título é um `<Text>` do Fluent UI, que por padrão aplica `white-space: normal` e anula o `nowrap` da linha; a pasta (`<Caption1>`) tem o mesmo padrão.
- `db::snippets::search_snippets` ordena por `bm25(snippets_fts, 10.0, 1.0)`. O peso maior do título não garante que ele venha primeiro: um texto com o termo repetido no conteúdo pode superar um texto com o termo só no título. Exemplo relatado: buscando "assinatura", "20 - ASSINATURA" apareceu em 4º, atrás de "COLETA - TERCEIRO INDIVIDUAL", que não tem o termo no título.
- O mesmo comando `search_snippets` atende a busca do cadastro (`App.tsx`), que filtra a árvore e não depende da ordem; o menu mostra os resultados na ordem do backend (`docs/telas.md`).

## Decisões

1. Título e pasta das linhas do menu ficam em uma linha, cortados com reticências (`wrap={false}`).
2. Nova ordem da busca:
   1. textos em que todos os termos aparecem no título, antes dos demais;
   2. entre esses, por `bm25` só do título (títulos mais curtos e diretos primeiro);
   3. depois, por `bm25` só do conteúdo; empate pelo `id`.
3. Versão PATCH (correção).

## Escopo

- `src/Picker.tsx`: título e pasta sem quebra de linha, com teste.
- `src-tauri/src/db/snippets.rs`: nova ordenação, com testes.
- `docs/telas.md` (ordem dos resultados do menu) e `CHANGELOG.md`.

Fora do escopo: busca aproximada (erros de digitação), destaque do termo no menu, mudanças na busca do cadastro além da ordem do backend, correção da inicialização (janelas criadas antes do `setup`).

## Estado desejado

1. Buscando um termo, os textos com o termo no título aparecem antes dos que só o têm no conteúdo, e o título mais curto vem primeiro.
2. Títulos longos aparecem em uma linha, com reticências, sem sobrepor as linhas vizinhas.

## Premissas

- O FTS5 aceita filtro de coluna `title : (...)` com os termos já escapados por `fts_query`.
- `bm25` com peso 0 numa coluna ignora a contribuição dessa coluna.

## Riscos

- A ordem muda para todos os usuários; é a intenção da correção.
- A subconsulta do filtro de título roda por linha; o volume esperado de textos é pequeno.

## Estratégia de validação

- Automatizada: `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`, `npm run test`, `npm run lint`, `npm run build`.
- Funcional no Windows (Marco): busca "assinatura" no menu e títulos longos.

## Fases

### Fase 1 — Ordem da busca

- [x] Ordenar `search_snippets` conforme a decisão 2.
- [x] Testes: termo só no título acima de termo repetido no conteúdo; título curto acima de título longo; todos os termos no título acima de termos divididos entre título e conteúdo. Os testes falham com a ordenação anterior.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 2 — Linhas do menu

- [x] `wrap={false}` no título e na pasta das linhas do menu.
- [x] Teste do título e da pasta sem quebra de linha (falhava antes da correção).

Critério: `npm run test`, `npm run lint` e `npm run build` passam.

### Fase 3 — Documentação

- [x] `docs/telas.md` e `CHANGELOG.md` atualizados.

Critério: documentos descrevem a nova ordem e a correção.

## Marco — Validação do usuário

- [x] No menu de colagem, buscar "assinatura": "20 - ASSINATURA" aparece entre os primeiros, e os textos com o termo no título vêm antes dos que só o têm no conteúdo.
- [x] Títulos longos ficam em uma linha, com reticências, sem sobrepor as linhas vizinhas.
- [x] Aceite do usuário.

Resultado: validado pelo usuário no instalador de teste `CSTM_0.11.0-teste-073-20261014-0907_x64-setup.exe`; homologado em 2026-10-14.
