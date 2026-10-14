# p40 — Segundo plano

## Objetivo

Manter o CSTM em execução na bandeja do sistema: fechar a janela apenas a oculta, abrir o aplicativo de novo traz a janela existente e o encerramento acontece somente por "Sair" na bandeja, sem perder textos não salvos.

## Contexto

O aplicativo tem apenas a janela `main` (cadastro). Fechá-la encerra o processo: o frontend intercepta o pedido de fechamento, grava as pendências e, se algo não puder ser salvo, pede confirmação ("Sair sem salvar?") antes de chamar `destroy`. Rascunhos inválidos ou com erro ficam somente em memória (`docs/telas.md`, decisão 6). `docs/mvp.md` prevê o módulo `tray`, o feature `tray-icon` do `tauri` e o `tauri-plugin-single-instance`. Corresponde à etapa 4 de `docs/mvp.md`.

## Escopo

- Feature `tray-icon` do `tauri` e dependência `tauri-plugin-single-instance` 2.x.
- Módulo `tray` em `src-tauri/src/tray.rs`: ícone com dica "CSTM" e menu "Abrir cadastro", separador, "Sair"; clique esquerdo no ícone abre o cadastro, clique direito mostra o menu.
- Função única `show_main_window` (restaurar, mostrar e focar a janela `main`), usada pela bandeja, pela instância única e pelo comando de mesmo nome.
- "Sair" emite o evento `quit-requested` para a janela `main`; o frontend decide o encerramento.
- Comandos `show_main_window` e `exit_app` (`app.exit(0)`).
- Instância única: uma segunda execução mostra a janela existente e termina.
- Frontend: fechar a janela impede o fechamento, oculta a janela e grava as pendências, sem confirmação; o pedido de saída grava as pendências e encerra, ou mostra a janela e a confirmação "Sair sem salvar?" quando algo não pôde ser salvo.
- `api.ts`: `hideWindow`, `showWindow`, `exitApp` e `onQuitRequested`; remoção de `closeWindow`. `fakeApi.ts` acompanha.
- Capabilities: adicionar `core:window:allow-hide`; remover `core:window:allow-destroy`.
- Documentação: menu da bandeja e ciclo de vida da janela em `docs/telas.md`; `README.md` e `CHANGELOG.md`.

Fora do escopo: atalho global e janela `picker` (p50), iniciar com o Windows, aviso de "continua na bandeja" e ícone próprio (072).

## Estado desejado

1. Fechar a janela (X ou Alt+F4) a oculta e a remove da barra de tarefas; o processo e o ícone na bandeja continuam.
2. Clique no ícone ou "Abrir cadastro" traz a janela de volta, inclusive minimizada, com a mesma seleção e os mesmos rascunhos.
3. Um texto editado imediatamente antes de fechar a janela é gravado.
4. "Sair" sem pendências encerra o processo e remove o ícone.
5. "Sair" com rascunho inválido mostra a janela e a confirmação; cancelar mantém o aplicativo aberto.
6. Executar o aplicativo uma segunda vez não cria outro processo e traz a janela existente.

A janela abre visível ao iniciar o aplicativo.

## Premissas

- Com um ouvinte de fechamento registrado no frontend, o Tauri 2 deixa a decisão de fechar a janela para o frontend (mecanismo já usado no p30).
- `app.exit` encerra o aplicativo sem disparar o pedido de fechamento da janela.

## Riscos

- Se o frontend travar, "Sair" não encerra o aplicativo; resta o Gerenciador de Tarefas. Aceito no MVP.
- O Windows pode negar o foco à janela trazida pela segunda instância; nesse caso ela aparece, mas pode apenas piscar na barra de tarefas.
- O ícone da bandeja é o padrão do template até o 072.

## Estratégia de validação

- Testes do frontend: fechar oculta e grava sem confirmação; sair sem pendências encerra; sair com pendências mostra a janela e confirma; cancelar não encerra.
- `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`, `cargo build`.
- Validação manual no Windows dos itens do estado desejado.

## Fases

### Fase 1 — Backend

- [x] Adicionar o feature `tray-icon` e o `tauri-plugin-single-instance`.
- [x] Criar `tray.rs` com o ícone, o menu, `show_main_window` e o evento `quit-requested`.
- [x] Registrar a instância única e os comandos `show_main_window` e `exit_app`.
- [x] Ajustar as capabilities.

Critério: `cargo build`, `npm run lint:rust`, `npm run test:rust` e `cargo fmt --check` passam.

### Fase 2 — Frontend

- [x] Atualizar `api.ts` e `fakeApi.ts`.
- [x] Fechar a janela oculta e grava; pedido de saída grava, encerra ou confirma.
- [x] Testes do fechamento e da saída.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 3 — Documentação e validação

- [x] Atualizar `docs/telas.md`, `README.md` e `CHANGELOG.md`.
- [x] Validação manual no Windows.

Critério: validações automáticas passam e o roteiro manual é aprovado no Windows.

Validações automáticas e roteiro manual no Windows aprovados.
