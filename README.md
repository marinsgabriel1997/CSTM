<div align="center">

# CSTM

**Seus textos, atalhos e área de transferência em um só lugar.**

[![Versão](https://img.shields.io/github/v/release/marinsgabriel1997/CSTM?label=vers%C3%A3o)](https://github.com/marinsgabriel1997/CSTM/releases/latest)
[![Licença](https://img.shields.io/github/license/marinsgabriel1997/CSTM?label=licen%C3%A7a)](LICENSE)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows%2010%20%7C%2011-0078D4)](#instalação)

[Baixar](https://github.com/marinsgabriel1997/CSTM/releases/latest) · [Novidades](CHANGELOG.md) · [Documentação](docs/produto.md)

</div>

Organize e reutilize textos, acesse seu histórico de cópias e cole conteúdos rapidamente em qualquer aplicativo. Com um atalho global (`Alt+Q`), busca instantânea, pastas, favoritos e modos de colagem com formatação, o CSTM simplifica tarefas repetitivas no Windows.

Não é só um gerenciador de clipboard nem um expansor de texto: o CSTM reúne num menu flutuante, aberto junto ao cursor do mouse, os textos que você digita toda hora (respostas prontas, assinaturas, modelos de e-mail, trechos de código) e tudo o que você copiou recentemente.

## Funcionalidades

- **Cole em qualquer programa:** `Alt+Q` abre um menu junto ao mouse; escolha o texto e ele é colado onde você estava.
- **Histórico do que você copiou:** os últimos 100 itens copiados, com textos, formatação e imagens.
- **Organização simples:** pastas, favoritos e os textos mais usados à mão.
- **Busca instantânea** por título e conteúdo.
- **Cole no formato certo:** escreva seus textos em markdown e cole convertendo para texto sem formatação, texto formatado (e-mail, Word) ou Google Chat. No histórico, o que você copiou também pode ser convertido, venha de onde vier.

## Instalação

Requer Windows 10 ou 11, 64 bits.

1. Baixe `CSTM_<versão>_x64-setup.exe` na [página da última versão](https://github.com/marinsgabriel1997/CSTM/releases/latest).
2. Execute o instalador. Ele instala só para o seu usuário, em `%LOCALAPPDATA%\CSTM`, sem pedir administrador, e cria o atalho no Menu Iniciar. Se o WebView2 não estiver presente, o instalador o baixa.

O instalador ainda não tem assinatura digital, por isso o SmartScreen do Windows avisa ao executá-lo: use **Mais informações** › **Executar assim mesmo**. Para conferir o arquivo baixado, compare o resultado de `Get-FileHash .\CSTM_<versão>_x64-setup.exe` (PowerShell) com o `SHA256SUMS.txt` da release.

**Atualizar:** instale a versão nova por cima; os dados são preservados.

**Desinstalar:** use Configurações › Aplicativos do Windows. Os dados ficam guardados, a menos que você marque a opção de apagá-los no desinstalador.

## Como usar

1. No cadastro, crie um texto com **Novo** › **Novo texto** (`Ctrl+N`); o CSTM salva enquanto você digita.
2. Em qualquer programa, clique onde quer colar e pressione `Alt+Q`.
3. Escolha o texto: clique ou `Enter` cola, **Copiar** (`Ctrl+C`) só copia, `Esc` fecha.

Fechar a janela só a esconde: o CSTM continua na bandeja, perto do relógio, e o atalho continua valendo. A Ajuda completa está no próprio aplicativo (`F1`).

Os dados ficam em `%APPDATA%\com.gabriel.cstm\cstm.db`.

### Limitações conhecidas

- Programas abertos como administrador não recebem a colagem; use **Copiar** e cole com `Ctrl+V`.
- Depois de colar, só o texto que estava no clipboard é restaurado; imagens e outros formatos não voltam.

## Roadmap

- Editor que alterna entre markdown e visualização formatada, para escrever sem precisar conhecer a sintaxe. O banco continua guardando markdown.
- Interface em inglês, com escolha do idioma no aplicativo, e documentação em inglês.
- Cópia opcional dos dados na nuvem do próprio usuário (por exemplo, Google Drive), para backup e para usar em mais de um computador.

Fora do escopo, por ora: expansão automática por abreviação, variáveis nos textos (data, hora, cursor) e Linux/macOS. Detalhes em [docs/produto.md](docs/produto.md#fora-do-escopo).

## Desenvolvimento

Feito com [Tauri 2](https://tauri.app/) e Rust (edição 2024) no backend, e React 19, TypeScript, Vite e [Fluent UI React v9](https://react.fluentui.dev/) na interface.

### Requisitos

- Node.js e npm.
- Rust, com `rustfmt` e `clippy`.
- [Pré-requisitos do Tauri para Windows](https://tauri.app/start/prerequisites/) (Microsoft C++ Build Tools e WebView2).

### Primeiros passos

```powershell
git clone https://github.com/marinsgabriel1997/CSTM.git
cd CSTM
npm install
npm run tauri -- dev
```

### Comandos

| Comando | Descrição |
| --- | --- |
| `npm run tauri -- dev` | Iniciar o aplicativo em desenvolvimento |
| `npm run tauri -- build` | Gerar o instalador NSIS em `src-tauri/target/release/bundle/nsis/` |
| `npm run dev` | Iniciar somente o frontend Vite (porta 1420) |
| `npm run build` | Verificar tipos e gerar o build do frontend |
| `npm run lint` | ESLint no frontend |
| `npm run test` | Testes do frontend (Vitest e Testing Library) |
| `npm run test:rust` | Testes do backend (`cargo test`) |
| `npm run lint:rust` | Clippy no backend, com warnings tratados como erro |
| `npm run format:rust` | Formatar o backend com `cargo fmt` |

A formatação do frontend não é imposta pelo projeto; fica a cargo do editor.

### Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/` | Interface (React): cadastro, menu de colagem, Configurações, Ajuda e Sobre |
| `src-tauri/` | Backend (Rust): banco SQLite e migrações, comandos, menu, colagem, clipboard e bandeja |
| `docs/produto.md` | Funcionalidades, escopo, fluxo de colagem, arquitetura e modelo de dados |
| `docs/telas.md` e `docs/prototipo/` | Desenho aprovado das telas e protótipos em HTML |
| `planos/` | Planos de trabalho ativos; os concluídos ficam em `planos/executados/` |

### Instaladores locais

Cada build sobrescreve o instalador em `src-tauri/target/`, por isso as cópias ficam em `releases/` (fora do Git), sem substituir arquivos existentes: `releases/CSTM_<versão>_x64-setup.exe` para as versões publicadas e `releases/teste/CSTM_<versão>-teste-<plano>-<AAAAMMDD-HHMM>_x64-setup.exe` para os builds de teste.

## Contribuindo

- Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/) em português, por exemplo `feat(picker): adiciona busca nas colunas`.
- Mudanças notáveis entram no [CHANGELOG](CHANGELOG.md), no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).
- O fluxo de trabalho (planos, validação, versão e publicação de releases) está em [AGENTS.md](AGENTS.md).

## Licença

[MIT](LICENSE) © Gabriel de Marins
