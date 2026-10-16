<div align="center">

# CSTM

**Seus textos de todo dia, colados em qualquer programa com um atalho.**

[![Versão](https://img.shields.io/github/v/release/marinsgabriel1997/CSTM?label=vers%C3%A3o)](https://github.com/marinsgabriel1997/CSTM/releases/latest)
[![Licença](https://img.shields.io/github/license/marinsgabriel1997/CSTM?label=licen%C3%A7a)](LICENSE)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows%2010%20%7C%2011-0078D4)](#instalação)

[Baixar](https://github.com/marinsgabriel1997/CSTM/releases/latest) · [Novidades](CHANGELOG.md) · [Documentação](docs/produto.md)

</div>

O CSTM é um aplicativo para Windows que guarda os textos que você digita toda hora (respostas prontas, assinaturas, modelos de e-mail, trechos de código) e os cola em qualquer programa por um menu flutuante aberto com `Alt+Q`, junto ao cursor do mouse. Ele também guarda o histórico do clipboard e converte textos em markdown para o formato de destino na hora de colar.

## Funcionalidades

- **Menu de colagem por atalho global:** `Alt+Q` (configurável) abre o menu em qualquer programa; escolha o texto com o mouse ou o teclado e ele é colado no programa em que você estava, com o clipboard anterior restaurado.
- **Pastas, favoritos e mais usados:** organize os textos em pastas e subpastas, marque favoritos e encontre rápido os mais colados.
- **Navegação em cascata:** as pastas abrem em colunas ao lado, como os submenus do Windows, cada uma com busca própria; ou, se preferir, ao clicar.
- **Busca instantânea:** por título e conteúdo, sem diferenciar acentos, no cadastro e no menu.
- **Modos de colagem:** escreva em markdown e cole como markdown, sem formatação, formatado (Word, Outlook, Gmail, Teams) ou na sintaxe do Google Chat.
- **Histórico do clipboard:** os últimos 100 itens copiados em qualquer programa, com formatação e imagens, também com os modos de colagem; ignora o que os gerenciadores de senha marcam como sensível.
- **Cadastro como um gerenciador de arquivos:** seleção múltipla, arrastar e soltar, recortar/copiar/colar, desfazer e lixeira.
- **Importação e exportação:** arquivos `.txt`, pastas do disco e backup JSON completo.
- **Sempre à mão:** roda na bandeja do sistema, pode iniciar com o Windows e segue o tema claro ou escuro.
- **Seus dados no seu computador:** tudo fica num banco SQLite local, sem conta nem nuvem.

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

- Interface em inglês, com escolha do idioma no aplicativo, e documentação em inglês.

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
