# p55 — Configurações

## Objetivo

Adicionar uma tela de configurações que, inicialmente, permite trocar o atalho global do menu de colagem. O padrão continua `Alt+Q`; a troca vale imediatamente e é lembrada entre execuções.

## Contexto

O atalho `Alt+Q` é uma constante do módulo `picker` (p50), registrada ao iniciar; a falha de registro aparece como aviso no cadastro (`shortcut_error`). Não há tela de configurações nem preferências persistidas no backend: o banco tem apenas `folders`, `snippets` e `snippets_fts` (migração `0001_initial.sql`). A configuração do atalho pela interface constava como fora do escopo em `docs/mvp.md` ("avaliar se sobrar tempo") e entra no escopo com este plano.

## Decisões

1. Plano próprio, executado depois do commit do p50.
2. Configurações em um diálogo da janela de cadastro, aberto pelo botão de engrenagem na barra inferior, pelo item "Configurações" da bandeja e pela ação "Alterar atalho" do aviso de atalho indisponível.
3. Atalho persistido no SQLite, em uma tabela `settings` (chave e valor) criada por nova migração.
4. Combinações aceitas: `Ctrl` ou `Alt` obrigatório, `Shift` opcional, sem `Win`; tecla principal entre letras, números, `F1`–`F12` e `Espaço`. Combinações com `Ctrl+Alt` são aceitas com aviso sobre o AltGr.

## Escopo

- Desenho do diálogo em `docs/telas.md` e protótipo em `docs/prototipo/configuracoes.html`, aprovados antes da implementação.
- Migração `0002_settings.sql` com a tabela `settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`; funções de leitura e gravação no `db`, com testes.
- Atalho configurado lido ao iniciar (ou `Alt+Q` quando não houver valor salvo) e mantido em estado do Tauri no lugar da constante.
- Comandos: `get_shortcut` (atalho atual e erro de registro, se houver), `set_shortcut` (valida, registra o novo, libera o anterior e só então grava; em falha, nada muda), `suspend_shortcut` e `resume_shortcut` (o atalho atual fica inativo enquanto o diálogo grava uma combinação, para que possa ser pressionado).
- Validação das combinações no backend, com testes; o formato gravado é o mesmo aceito pelo `tauri-plugin-global-shortcut` (por exemplo, `Alt+KeyQ`), com exibição amigável (`Alt+Q`) no frontend.
- Item "Configurações" no menu da bandeja, entre "Abrir cadastro" e "Sair", que mostra a janela e abre o diálogo (evento para a janela `main`).
- Frontend: diálogo de configurações com gravador de combinação, "Restaurar padrão", erro de registro e aviso de `Ctrl+Alt`; botão de engrenagem na barra inferior; ação "Alterar atalho" no aviso de atalho indisponível; o aviso de atalho indisponível passa a mostrar o atalho configurado.
- Testes do frontend (gravar, cancelar, restaurar, combinação inválida, erro de registro, abertura pela bandeja e pelo aviso).
- Documentação: `docs/mvp.md` (configuração do atalho no escopo), `docs/telas.md`, `AGENTS.md` (atalho padrão configurável), `README.md` e `CHANGELOG.md`.

Fora do escopo: outras configurações (iniciar com o Windows, tema, posição do menu), atalhos com `Win` e atalhos sem modificador.

## Estado desejado

1. O diálogo abre pela engrenagem, pela bandeja e pelo aviso de atalho indisponível, mostrando o atalho atual.
2. "Alterar" grava a próxima combinação válida; `Esc` cancela e mantém o atalho anterior; combinação inválida mostra a regra e continua aguardando.
3. O novo atalho abre o menu imediatamente e o anterior deixa de abrir.
4. O atalho escolhido continua valendo após encerrar e abrir o aplicativo.
5. Combinação recusada pelo Windows mostra o erro e mantém o atalho anterior funcionando.
6. "Restaurar padrão" volta para `Alt+Q`.
7. Atalho com `Ctrl+Alt` mostra o aviso sobre o AltGr.

## Premissas

- O `tauri-plugin-global-shortcut` permite registrar e liberar atalhos em tempo de execução e informa a falha de registro.
- O `KeyboardEvent.code` do WebView identifica a tecla física, compatível com o formato de atalho do plugin.

## Riscos

- Em teclados ABNT2, AltGr equivale a `Ctrl+Alt`: um atalho `Ctrl+Alt+<tecla>` pode bloquear caracteres digitados com AltGr. Mitigado pelo aviso.
- O Windows só informa se a combinação está livre ao registrá-la; o fluxo de erro cobre esse caso.
- Se o diálogo for fechado ou a janela ocultada durante a gravação, o atalho suspenso precisa ser reativado; coberto por teste.
- A migração `0002` passa a ser contrato após o primeiro uso real.

## Estratégia de validação

- Testes do backend: migração, leitura e gravação de configurações, validação e conversão de combinações.
- Testes do frontend com Vitest e `fakeApi`.
- `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`, `cargo build`.
- Validação manual no Windows dos itens do estado desejado.

## Fases

### Fase 1 — Desenho

- [x] Criar o protótipo `docs/prototipo/configuracoes.html`.
- [x] Desenhar o diálogo em `docs/telas.md`.

Critério: desenho e protótipo aprovados pelo usuário.

Desenho e protótipo aprovados.

### Fase 2 — Backend

- [x] Migração `0002_settings.sql` e funções de configurações no `db`, com testes.
- [x] Atalho configurável no `picker`, com validação e testes.
- [x] Comandos `get_shortcut`, `set_shortcut`, `suspend_shortcut` e `resume_shortcut`.
- [x] Item "Configurações" na bandeja.

Critério: `cargo build`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Frontend

- [x] Atualizar `api.ts` e `fakeApi.ts`.
- [x] Diálogo de configurações com gravador de combinação.
- [x] Engrenagem na barra inferior, ação no aviso e abertura pela bandeja.
- [x] Atalho configurado no aviso de atalho indisponível.
- [x] Testes do frontend.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Documentação e validação

- [x] Atualizar `docs/mvp.md`, `docs/telas.md`, `AGENTS.md`, `README.md` e `CHANGELOG.md`.
- [x] Validação manual no Windows.

Critério: validações automáticas passam e o roteiro manual é aprovado no Windows.

Validações automáticas e roteiro manual no Windows aprovados.
