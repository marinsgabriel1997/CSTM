# Changelog

Todas as mudanças notáveis deste projeto são registradas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.6.0] - 2026-10-13

### Added

- Configurações, abertas pela engrenagem na barra inferior do cadastro ou pelo menu do ícone na bandeja: o atalho do menu de colagem pode ser trocado pressionando a nova combinação. O novo atalho vale na hora e é lembrado entre execuções; se outro programa já usar a combinação, o atalho anterior continua valendo. "Restaurar padrão" volta para `Alt+Q`.

### Changed

- O aviso de atalho indisponível mostra o atalho configurado e oferece "Alterar atalho".

## [0.5.0] - 2026-10-13

### Added

- Menu de colagem aberto por `Alt+Q` em qualquer programa, junto ao cursor do mouse e sempre dentro da tela: busca em todos os textos, favoritos e pastas navegáveis, pelo teclado (setas, `Enter`, `→`/`←`, `Esc`) ou pelo mouse. Escolher um texto o copia para o clipboard; `Esc`, clicar fora ou `Alt+Q` fecham o menu.
- Aviso no cadastro quando o atalho `Alt+Q` não pode ser registrado, por exemplo por já estar em uso por outro programa.

## [0.4.0] - 2026-10-13

### Added

- Ícone na bandeja do sistema: o clique abre o cadastro e o menu oferece "Abrir cadastro" e "Sair".
- Apenas uma instância do aplicativo por vez: abri-lo de novo traz a janela que já está aberta.

### Changed

- Fechar a janela apenas a oculta, gravando as alterações; o aplicativo continua na bandeja e os textos que não puderam ser gravados permanecem em memória. A confirmação para descartar esses textos passa a acontecer ao escolher "Sair".

## [0.3.0] - 2026-10-13

### Added

- Tela de cadastro na janela principal, no visual do Windows 11 (Fluent UI) e acompanhando o tema claro ou escuro do sistema: uma árvore única com pastas e textos à esquerda e o editor sempre aberto à direita, separados por um divisor arrastável.
- Salvamento automático: os textos são gravados após uma pausa na digitação, ao trocar de item e quando a janela perde o foco (`Ctrl+S` grava na hora). A barra inferior mostra o estado do salvamento e os totais da biblioteca.
- Textos com título ou conteúdo vazio não são gravados, mas também não se perdem: ficam marcados na árvore até serem corrigidos, mantendo a última versão salva. Falhas ao gravar mantêm as alterações e oferecem "Tentar novamente"; fechar a janela com algo que não pôde ser gravado pede confirmação.
- Criação pelo botão "Novo" (`Ctrl+N` para texto, `Ctrl+Shift+N` para pasta), na pasta selecionada; a pasta nova é nomeada na própria árvore.
- Menu de contexto (clique direito ou botão "…") para renomear (`F2`), mover para outra pasta (`Ctrl+M`), reordenar (`Alt+↑`/`Alt+↓`), favoritar e excluir (`Del`). Excluir pede confirmação e informa o que vai junto: subpastas, textos e favoritos.
- Editor com o caminho da pasta no topo, título em destaque e conteúdo editados diretamente; selecionar uma pasta mostra seu resumo, com atalhos para criar dentro dela.
- Busca em títulos e conteúdos que filtra a própria árvore, mantendo as pastas dos resultados, destacando o termo e mostrando um trecho quando a correspondência é só no conteúdo. Filtro de favoritos com o mesmo comportamento.
- Navegação pela árvore com o teclado (setas, Home, End, Enter). A largura da árvore e as pastas recolhidas são lembradas entre execuções.
- Primeiro uso com apresentação do aplicativo e atalhos para criar o primeiro texto ou pasta.
- Testes automatizados do frontend (`npm run test`).

### Changed

- A janela principal abre com 1000×650 e não pode ser reduzida abaixo de 760×480.

## [0.2.0] - 2026-10-13

### Added

- Banco SQLite em `%APPDATA%\com.gabriel.cstm\cstm.db`, criado e migrado automaticamente ao iniciar o aplicativo.
- Persistência de pastas (com subpastas) e textos no backend: criação, edição, exclusão, ordenação manual, movimentação entre pastas, favoritos, contagem de uso e busca por título e conteúdo que ignora acentos e aceita prefixos. Ainda sem interface.
- Testes automatizados do backend (`npm run test:rust`).

## [0.1.1] - 2026-10-13

### Added

- Lint do frontend com ESLint (`npm run lint`).
- Lint do backend com clippy (`npm run lint:rust`) e formatação com rustfmt (`npm run format:rust`).
- Quebras de linha LF fixadas via `.gitattributes`.

### Removed

- Exemplo do template (comando `greet`, plugin `opener` e logotipos de Vite, Tauri e React); a janela principal exibe apenas uma tela mínima.
