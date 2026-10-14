# 076 — Configurações do usuário

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Acrescentar duas opções às Configurações: **Iniciar com o Windows** e **Tema** (seguir o Windows, claro ou escuro). No menu de colagem, cada texto ganha um botão **Copiar**, para copiar o texto em vez de colá-lo. Clicar no texto continua colando.

## Contexto

- O diálogo de Configurações (p55, `src/components/SettingsDialog.tsx`) já tem o atalho do menu de colagem e a navegação nas pastas. As configurações ficam na tabela `settings` (chave e valor) do SQLite, lidas e gravadas por `src-tauri/src/db/settings.rs`.
- **Tema:** o tema segue o Windows por `usePrefersDark` (`src/theme.ts`), aplicado pelo `Root` nas duas janelas. A barra de título nativa do cadastro também segue o Windows.
- **Inicialização:**
  - Iniciar com o Windows consta como fora do escopo em `docs/mvp.md` e em `AGENTS.md`. Este plano o traz para o escopo.
  - Hoje o aplicativo sempre mostra o cadastro ao iniciar.
  - O desinstalador (`src-tauri/windows/installer.nsi`) já apaga o valor `CSTM` da chave `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, fora das atualizações. É o nome que a entrada do CSTM usa.
- **Escolha no menu de colagem:**
  - Escolher um texto no menu chama `choose_snippet`, e `paste::paste` reativa a janela anterior, cola e restaura o clipboard em 500 ms.
  - Não há como apenas copiar pelo menu de colagem.
  - No cadastro, "Copiar" de um único texto põe o conteúdo no clipboard sem contar como uso.

## Decisões

1. **Iniciar com o Windows:**
   - Desligado por padrão.
   - Gravado pelo backend, por comandos próprios, diretamente na chave `Run` do usuário (ver Fase 1).
   - A fonte da verdade é o registro do Windows, não a tabela `settings`. Assim, o diálogo mostra a opção desligada se o usuário a desativar no Gerenciador de Tarefas.
2. **Início pelo Windows:**
   - O aplicativo é registrado com o argumento `--autostart`. Com ele, o cadastro começa oculto: só o ícone da bandeja e o atalho ficam ativos.
   - Abrir o aplicativo manualmente continua mostrando o cadastro.
   - Uma segunda execução com `--autostart` com o aplicativo já aberto não mostra o cadastro.
3. **Tema:**
   - Opções "Seguir o Windows" (padrão, como hoje), "Claro" e "Escuro".
   - Gravado na tabela `settings` (chave `theme`: `system`, `light` ou `dark`).
   - Vale na hora nas duas janelas, por um evento emitido pelo backend. A barra de título do cadastro acompanha.
4. **Copiar no menu de colagem:**
   - Clicar no texto ou pressionar `Enter` continua colando.
   - Um botão pequeno à direita da linha do texto, com o ícone clássico de copiar (`Copy16Regular` do Fluent: duas folhas sobrepostas), copia o texto.
   - O botão aparece na linha selecionada, que segue o mouse e o teclado. É o mesmo padrão do botão `...` da árvore do cadastro e evita repetir um ícone em todas as linhas.
   - Dica do botão: "Copiar (Ctrl+C)".
   - `Ctrl+C` copia o texto selecionado quando não há texto selecionado no campo de busca. Com texto selecionado, `Ctrl+C` copia o trecho da busca, como em qualquer campo.
5. **Ao copiar:**
   - O menu fecha e o foco volta ao programa anterior.
   - O texto fica no clipboard, sem `Ctrl+V` simulado e sem restaurar o conteúdo anterior.
   - Conta como um uso (contador e último uso), como a colagem, porque o texto foi escolhido no menu para ser usado.
6. **Pastas e linhas que não são textos** (pastas, Mais usados, Favoritos, linha de volta) não têm botão Copiar.

## Escopo

- **Backend:**
  - Entrada na chave `Run` do usuário com o argumento `--autostart` (ver Fase 1).
  - Comandos `get_autostart` e `set_autostart`.
  - Cadastro oculto ao iniciar com `--autostart`, inclusive na segunda execução.
  - Configuração `theme` no `db::settings`, com comandos `get_theme` e `set_theme`. O `set_theme` valida o valor, grava, emite `theme-changed` às duas janelas e aplica o tema à janela `main`. O tema gravado também é aplicado à `main` ao iniciar.
  - Comando `copy_snippet`, com `paste::copy`: reativa a janela anterior, fecha o menu, escreve no clipboard e registra o uso.
- **Frontend:**
  - `api.ts` e `fakeApi.ts` com os novos comandos e o evento `theme-changed`.
  - `Root` aplica o tema escolhido, com "Seguir o Windows" continuando a acompanhar o sistema.
  - Diálogo de Configurações com as seções Tema e Iniciar com o Windows.
  - Botão Copiar e `Ctrl+C` no menu de colagem.
- **Testes:**
  - Rust: configuração de tema (padrão, gravação, valor inválido) e detecção do argumento `--autostart`.
  - Vitest: tema aplicado e trocado, opção de inicialização (ligar, desligar, erro), botão Copiar (aparece só na linha de texto selecionada, copia sem colar, não dispara a linha) e `Ctrl+C` com e sem texto selecionado na busca.
- **Documentação:**
  - `docs/telas.md`: Tela 2 e Tela 3.
  - Protótipos `docs/prototipo/picker.html` e `docs/prototipo/configuracoes.html`.
  - `docs/mvp.md`: Configurações e fora do escopo.
  - `AGENTS.md`: retirar "inicialização com Windows" de fora do escopo.
  - `CHANGELOG.md`.

Fora do escopo:
- quantidade de Mais usados;
- ocultar as pastas virtuais;
- posição do menu;
- backup automático;
- idioma;
- tempo de restauração do clipboard;
- iniciar com o Windows por padrão no instalador.

## Estado desejado

Diálogo de Configurações (as seções novas ficam abaixo das atuais, separadas por linhas; o tema em linha para poupar altura):

```text
+------------------------------------------------+
| Configurações                              [X] |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
| [ Alt + Q                        ] [ Alterar ] |
| ---------------------------------------------- |
| Navegação nas pastas                           |
| Como as pastas se abrem no menu de colagem.    |
| Vale a partir da próxima abertura do menu.     |
| (o) Abrir ao passar o mouse  padrão            |
| ( ) Clicar para abrir                          |
| ---------------------------------------------- |
| Tema                                           |
| (o) Seguir o Windows  ( ) Claro  ( ) Escuro    |
| ---------------------------------------------- |
| [ o] Iniciar com o Windows                     |
|      Abre na bandeja ao entrar no Windows,     |
|      com o atalho já ativo.                    |
|                                                |
| [ Restaurar padrão (Alt+Q) ]        [ Fechar ] |
+------------------------------------------------+
```

Menu de colagem com o texto selecionado (`[⧉]` é o botão Copiar, só na linha selecionada):

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
|    Mais usados                     > |
|    Favoritos                       > |
|    Trabalho                        > |
| => Telefone                    [⧉]   |
|    Link da agenda                    |
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

1. A opção Iniciar com o Windows liga e desliga a entrada do CSTM na inicialização do Windows. Ligada, o CSTM abre na bandeja ao entrar no Windows, sem mostrar o cadastro, e o atalho funciona.
2. Desativar o CSTM no Gerenciador de Tarefas faz a opção aparecer desligada no diálogo.
3. O tema escolhido vale na hora no cadastro (inclusive na barra de título) e no menu de colagem, e é lembrado entre execuções. "Seguir o Windows" acompanha a troca de tema do sistema com o aplicativo aberto.
4. No menu de colagem, a linha de texto selecionada mostra o botão Copiar à direita. Clicar nele fecha o menu e deixa o texto no clipboard, sem colar, com o foco de volta no programa anterior.
5. `Ctrl+C` no menu faz o mesmo com o texto selecionado. Com um trecho da busca selecionado, copia esse trecho.
6. Clicar no texto ou `Enter` continua colando como hoje.
7. Copiar pelo menu conta como uso do texto.

## Premissas

- O Gerenciador de Tarefas marca a desativação na chave `StartupApproved` com o primeiro byte ímpar (`03`/`07`); `02`/`06` significam ativada.
- `WebviewWindow::set_theme` muda a barra de título nativa no Windows.
- Os ícones `Copy16Regular`/`Copy20Regular` existem no `@fluentui/react-icons` instalado.

## Riscos

- **Gerenciador de Tarefas:** se a `StartupApproved` não for lida ou reativada, a opção pode aparecer ligada sem efeito, ou ser religada sem efeito depois de uma desativação no Gerenciador de Tarefas. Verificar na Fase 1. Se a premissa falhar, implementar a entrada diretamente no registro (feature `Win32_System_Registry` do crate `windows`), tratando também a `StartupApproved`, sem mudar o restante do plano.
- **Caminho do executável:** a entrada na inicialização aponta para o executável que a ligou. Ligada num build de desenvolvimento, aponta para ele. A validação manual usa o instalador de teste.
- **Gravar com o clipboard ocupado:** escrever no clipboard pode falhar se outro programa o mantiver aberto. O erro aparece no menu, como na colagem.
- **Altura do diálogo:** com quatro seções, o diálogo fica mais alto. Na altura mínima do cadastro (480), o conteúdo do diálogo rola, como permite o Fluent.

## Estratégia de validação

- `npm run test`, `npm run build`, `npm run lint`.
- `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`.
- Instalador de teste em `releases/teste/` para a validação manual no Windows: inicialização com o Windows (inclusive reiniciar ou sair e entrar na sessão), Gerenciador de Tarefas, tema e copiar no menu.
- Teste automatizado não cobre a inicialização real com o Windows nem a barra de título; isso fica na validação manual.

## Fases

### Fase 1 — Backend

- [x] Verificar o `tauri-plugin-autostart` (2.7.0, sobre o `auto-launch` 0.6). A premissa da `StartupApproved` se confirmou: ele a lê e a reativa. Porém, o plugin tenta primeiro `HKLM` (todos os usuários) quando o processo tem permissão, sem opção para mudar isso, e grava o caminho do executável sem aspas. Aplicada a alternativa dos Riscos: módulo `autostart` próprio, só em `HKCU`, com o caminho entre aspas, usando a feature `Win32_System_Registry` do crate `windows`. O nome do valor é `CSTM`, o mesmo que o desinstalador apaga. Sem dependência nova.
- [x] Comandos `get_autostart` e `set_autostart`.
- [x] Janela `main` criada oculta quando o aplicativo é iniciado com `--autostart`; a segunda execução com `--autostart` não mostra o cadastro. Testes da detecção do argumento, das aspas e da marca do Gerenciador de Tarefas.
- [x] Configuração `theme` em `db::settings` (padrão `system`), com testes; módulo `theme` com `get_theme` e `set_theme` (valida, grava, emite `theme-changed`, aplica à `main`); tema gravado aplicado à `main` ao iniciar.
- [x] `paste::copy` e comando `copy_snippet`, que registra o uso.
- [x] Comandos registrados em `lib.rs`.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

Resultado: 93 testes do Rust passam; clippy e `cargo fmt --check` sem apontamentos.

### Fase 2 — Frontend

- [x] `api.ts` e `fakeApi.ts` com `getAutostart`, `setAutostart`, `getTheme`, `setTheme`, `onThemeChanged` e `copySnippet`.
- [x] `Root` com o tema escolhido (`useDarkTheme` em `src/theme.ts`, seguindo o Windows em `system`), nas duas janelas.
- [x] Seções Tema e Iniciar com o Windows no diálogo de Configurações, com erro de leitura e de gravação.
- [x] Botão Copiar na linha de texto selecionada e `Ctrl+C` no menu de colagem.
- [x] Testes do Vitest listados no Escopo (`src/theme.test.tsx`, `src/App.test.tsx`, `src/Picker.test.tsx`).

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

Resultado: 157 testes do frontend passam; build e lint sem apontamentos. Teste manual temporário do registro (descartado depois): ligar grava `"<exe>" --autostart` em `Run` e `02 00…` em `StartupApproved`; uma desativação simulada do Gerenciador de Tarefas aparece como desligada e ligar de novo a reativa; desligar remove os dois valores.

### Fase 3 — Documentação e instalador de teste

- [x] `docs/telas.md` (bandeja; Tela 2: botão Copiar e `Ctrl+C`; Tela 3: Tema e Iniciar com o Windows) e os protótipos `picker.html` e `configuracoes.html`.
- [x] `docs/mvp.md` (Configurações, menu de colagem, módulos `theme` e `autostart`; Iniciar com o Windows saiu de fora do escopo) e `AGENTS.md` (contexto e escopo).
- [x] `CHANGELOG.md` em `[Unreleased]`.
- [x] Instalador de teste `releases/teste/CSTM_0.11.3-teste-076-20261014-1342_x64-setup.exe`.

Critério: todas as validações automatizadas da estratégia passam e o instalador de teste existe.

Resultado:
- Validações automatizadas: 157 testes do frontend, build e lint; 93 testes do Rust, clippy e `cargo fmt --check`.
- Build de release iniciado com `--autostart`: o processo fica ativo com as duas janelas ocultas.
- Não verificados pelo agente: o início real pelo Windows ao entrar na sessão, o Gerenciador de Tarefas, a barra de título com o tema e o copiar no menu de colagem em uso real.

## Marco — Validação do usuário

Com o instalador de teste instalado:

- [x] Ligar Iniciar com o Windows, sair e entrar na sessão (ou reiniciar): o CSTM abre só na bandeja e o atalho abre o menu.
- [x] Desligar a opção: o CSTM não abre mais ao entrar no Windows.
- [x] Desativar o CSTM no Gerenciador de Tarefas (aba Aplicativos de inicialização): o diálogo mostra a opção desligada.
- [x] Abrir o CSTM manualmente com a opção ligada: o cadastro aparece normalmente.
- [x] Tema Claro e Escuro valem na hora no cadastro (com a barra de título) e no menu; "Seguir o Windows" acompanha a troca de tema do sistema; a escolha persiste após sair e abrir.
- [x] No menu, o botão Copiar aparece na linha de texto selecionada; clicar copia sem colar e o foco volta ao programa anterior; `Ctrl+V` manual cola o texto.
- [x] `Ctrl+C` no menu copia o texto selecionado; com um trecho da busca selecionado, copia o trecho.
- [x] Clicar no texto ou `Enter` continua colando.
- [x] O contador de uso do texto aumenta ao copiar pelo menu.

Aceite: homologado pelo usuário em 2026-10-14, com o instalador de teste `CSTM_0.11.3-teste-076-20261014-1342_x64-setup.exe`.
