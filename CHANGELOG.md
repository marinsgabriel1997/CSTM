# Changelog

Todas as mudanças notáveis deste projeto são registradas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.1.1] - 2026-10-13

### Added

- Lint do frontend com ESLint (`npm run lint`).
- Lint do backend com clippy (`npm run lint:rust`) e formatação com rustfmt (`npm run format:rust`).
- Quebras de linha LF fixadas via `.gitattributes`.

### Removed

- Exemplo do template (comando `greet`, plugin `opener` e logotipos de Vite, Tauri e React); a janela principal exibe apenas uma tela mínima.
