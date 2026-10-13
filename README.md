# CSTM

Aplicativo desktop para cadastrar, organizar e colar textos reutilizáveis por meio de um menu flutuante aberto por atalho global. O MVP tem como alvo o Windows.

O escopo e a arquitetura pretendidos estão em [docs/mvp.md](docs/mvp.md). O projeto está em desenvolvimento: a tela de cadastro (pastas, textos, favoritos e busca) está disponível; o menu de colagem, o atalho global e a bandeja ainda não existem.

Os dados ficam em `%APPDATA%\com.gabriel.cstm\cstm.db` (SQLite).

## Stack

React 19, TypeScript, Vite, Fluent UI React v9, Tauri 2 e Rust (edição 2024).

## Requisitos

- Node.js e npm.
- Rust (com `rustfmt` e `clippy`) e os [pré-requisitos do Tauri para Windows](https://tauri.app/start/prerequisites/).

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm install` | Instalar as dependências do frontend |
| `npm run tauri -- dev` | Iniciar o aplicativo desktop em desenvolvimento |
| `npm run tauri -- build` | Construir o aplicativo desktop |
| `npm run dev` | Iniciar somente o frontend Vite (porta 1420) |
| `npm run build` | Verificar tipos e gerar o build do frontend |
| `npm run lint` | Executar o ESLint no frontend |
| `npm run test` | Executar os testes do frontend (Vitest) |
| `npm run test:rust` | Executar os testes do backend |
| `npm run lint:rust` | Executar o clippy no backend, com warnings tratados como erro |
| `npm run format:rust` | Formatar o backend com `cargo fmt` |

A formatação do frontend não é imposta pelo projeto; fica a cargo do editor.
