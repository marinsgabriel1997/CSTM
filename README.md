# CSTM

Aplicativo desktop para cadastrar, organizar e colar textos reutilizáveis por meio de um menu flutuante aberto por atalho global. O MVP tem como alvo o Windows.

O escopo e a arquitetura pretendidos estão em [docs/mvp.md](docs/mvp.md). O projeto está em desenvolvimento: a tela de cadastro (pastas, textos, favoritos e busca), a execução em segundo plano (ícone na bandeja e instância única), o menu de colagem com a colagem no programa anterior, as configurações, a importação e exportação e as operações da árvore (seleção múltipla, arrastar e soltar, recortar/copiar/colar, lixeira e desfazer) estão disponíveis.

Fechar a janela apenas a oculta: o CSTM continua na bandeja do sistema, e o cadastro é reaberto pelo ícone. Para encerrar, use "Sair" no menu do ícone.

`Alt+Q`, em qualquer programa, abre o menu de colagem junto ao cursor do mouse; as pastas abrem em colunas ao lado quando o mouse passa sobre elas (ou, se preferir, ao clicar). O atalho e a navegação nas pastas podem ser trocados em Configurações (engrenagem na barra inferior do cadastro ou menu do ícone na bandeja).

Os dados ficam em `%APPDATA%\com.gabriel.cstm\cstm.db` (SQLite). O botão `...` ao lado de "Novo", no cadastro, importa arquivos `.txt`, pastas e backups JSON e exporta a biblioteca; uma pasta pode ser exportada pelo seu menu de contexto.

Na árvore do cadastro valem os atalhos de um gerenciador de arquivos: Ctrl+clique, Shift+clique e Ctrl+A (seleção múltipla), Ctrl+X, Ctrl+C e Ctrl+V (mover e copiar), Ctrl+Z (desfazer), F2 (renomear), Del (enviar para a lixeira) e Shift+Del (excluir definitivamente). Itens excluídos ficam na Lixeira, no fim da árvore, até serem restaurados ou excluídos definitivamente.

## Instalação

`npm run tauri -- build` gera o instalador em `src-tauri/target/release/bundle/nsis/CSTM_<versão>_x64-setup.exe`. Ele instala o CSTM somente para o usuário atual, em `%LOCALAPPDATA%\CSTM`, sem pedir administrador, e cria o atalho no Menu Iniciar. Se o WebView2 não estiver presente, o instalador o baixa.

Cada build sobrescreve esse arquivo, por isso os instaladores são guardados em `releases/` (fora do Git), copiados sem nunca substituir um arquivo existente:

- `releases/CSTM_<versão>_x64-setup.exe`: versões homologadas, uma por versão, copiadas após o aceite e o commit da versão;
- `releases/teste/CSTM_<versão>-teste-<plano>-<AAAAMMDD-HHMM>_x64-setup.exe`: builds de teste, identificados pelo plano e pela data e hora do build.

O instalador não tem assinatura digital, por isso o SmartScreen do Windows avisa ao executá-lo: use "Mais informações" e "Executar assim mesmo".

Reinstalar por cima preserva os dados em `%APPDATA%\com.gabriel.cstm`. Ao desinstalar, os dados também são mantidos, a menos que a opção de apagar os dados do aplicativo seja marcada. Para desinstalar, use Configurações > Aplicativos ou execute o instalador da mesma versão e escolha "Desinstalar CSTM".

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
