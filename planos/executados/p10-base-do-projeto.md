# p10 — Base do projeto

## Objetivo

Remover o exemplo do template Tauri + React e padronizar lint do frontend e lint e formatação do backend, sem adicionar funcionalidades.

## Contexto

O repositório contém o scaffold gerado pelo template: comando `greet`, plugin `opener`, assets de Vite/Tauri/React e README do template. Não há ferramentas de lint/formatação, comandos de teste, `CHANGELOG.md` nem planos anteriores. Corresponde à etapa 1 de `docs/mvp.md`.

## Escopo

- Remover `greet`, o plugin `opener` (Rust, npm e capability) e os assets do template.
- Reduzir `App.tsx` e `App.css` a uma tela mínima.
- Declarar explicitamente o label `main` da janela em `tauri.conf.json`.
- Configurar ESLint (flat config, `typescript-eslint`, regras de hooks do React). A formatação do frontend fica a cargo do editor; o projeto não inclui Prettier.
- Configurar `rustfmt.toml` e clippy com warnings tratados como erro.
- Adicionar scripts npm de lint (frontend e Rust) e formatação Rust.
- Fixar quebras de linha LF via `.gitattributes`, evitando diffs por `core.autocrlf`.
- Atualizar README, criar `CHANGELOG.md` e atualizar a seção de comandos do `AGENTS.md`.

Fora do escopo: qualquer funcionalidade do MVP, infraestrutura de testes (Rust no p20; frontend avaliado no p30).

## Estado desejado

- Nenhuma referência a `greet`, `opener` ou assets do template.
- Scripts `lint`, `lint:rust` e `format:rust` executam sem erros; `cargo fmt --check` passa.
- `npm run build` e `cargo build` passam.

## Premissas

- Versões atuais de ESLint/`typescript-eslint` são compatíveis com TypeScript 6.
- A remoção do `opener` não afeta funcionalidade prevista no MVP.

## Riscos

- Incompatibilidade de `typescript-eslint` com TypeScript 6 exigiria ajuste de versão.

## Estratégia de validação

- `npm run build`, `npm run lint`.
- `cargo build`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`.
- Busca textual por `greet`, `opener`, `vite.svg`, `tauri.svg`, `react.svg`.
- Sem mudança de comportamento testável; validação manual no Windows opcional (`npm run tauri -- dev` abre a janela mínima).

## Fases

### Fase 1 — Remover o template

- [x] Remover `greet` e o plugin `opener` de `lib.rs`, `Cargo.toml`, `package.json` e `capabilities/default.json`.
- [x] Remover `src/assets/react.svg`, `public/tauri.svg`, `public/vite.svg` e a referência de favicon em `index.html`.
- [x] Reduzir `App.tsx` e `App.css` a uma tela mínima.
- [x] Declarar `"label": "main"` na janela em `tauri.conf.json`.

Critério: `npm run build` e `cargo build` passam; a busca textual não encontra referências do template.

### Fase 2 — Ferramentas de qualidade

- [x] Instalar e configurar ESLint.
- [x] Adicionar `rustfmt.toml`.
- [x] Adicionar scripts `lint`, `lint:rust` e `format:rust`.
- [x] Adicionar `.gitattributes` com `eol=lf`.

Critério: todos os scripts executam sem erros.

### Fase 3 — Documentação

- [x] Substituir o README do template.
- [x] Criar `CHANGELOG.md` com `## [Unreleased]`.
- [x] Atualizar a seção de comandos do `AGENTS.md`.

Critério: documentação reflete os comandos efetivamente disponíveis.
