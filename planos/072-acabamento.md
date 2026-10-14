# 072 — Acabamento

- Status: Aguardando aprovação
- Prioridade: Média
- Criado em: 2026-10-14

## Objetivo

Dar ao CSTM identidade e distribuição próprias: ícone autoral, metadados do executável, instalador NSIS por usuário em português e comportamento de aplicativo (não de página web) no build de release, na versão 0.11.0.

## Contexto

Etapa 7 de `docs/mvp.md` ("Acabamento: ícones, nome, versão, instalador"). Hoje:

- `src-tauri/icons/` contém os ícones do template do Tauri (duas argolas amarela e azul), usados na janela, na barra de tarefas, no instalador e na bandeja (`tray.rs` usa `default_window_icon()`).
- `tauri.conf.json` tem `productName` e títulos "CSTM", `identifier` `com.gabriel.cstm` e `bundle.targets: "all"`, que no Windows gera MSI e NSIS; não define editor, copyright, descrições nem opções do NSIS.
- `Cargo.toml` descreve o app como "CSTM - Clipboard, Snippets & Text Manager".
- No release, o WebView2 mostra o menu de contexto do navegador onde o app não tem menu próprio e atende atalhos como F5, Ctrl+R, Ctrl+P e Ctrl+F; F5 recarrega o cadastro e pode perder edições pendentes.
- Não há certificado de assinatura de código.
- Ferramentas conferidas no planejamento: Tauri CLI 2.12.1; template NSIS do bundler 2.7.1 verificado no código-fonte.
- O protótipo `docs/prototipo/icone.html` reúne as opções de ícone avaliadas em 16, 32 e 256 px sobre fundo claro e escuro.

## Decisões

1. **Ícone:** opção A do protótipo `docs/prototipo/icone.html`, "Prancheta": quadrado azul `#0F6CBD` de cantos arredondados, folha branca com presilha âmbar `#FFB900` e três linhas de texto azuis. Escolhida no planejamento. O SVG da opção A (o `<symbol>` correspondente no protótipo) vira `src-tauri/icons/icon.svg`, fonte de `npx tauri icon`, que gera todos os formatos (`.ico` com 16, 24, 32, 48, 64 e 256 px). A bandeja continua usando o ícone da janela.
2. **Nome:** "CSTM" continua como nome visível. O `identifier` `com.gabriel.cstm` não muda, pois localiza o banco em `%APPDATA%\com.gabriel.cstm\cstm.db`.
3. **Metadados** em `bundle`: `publisher` "CSTM"; `copyright` "© 2026 CSTM"; `shortDescription` "CSTM - Clipboard, Snippets & Text Manager" (mesma descrição do `Cargo.toml`); `longDescription` curta em pt-BR, descrevendo o app (cadastrar textos em pastas e colar em qualquer programa pelo menu Alt+Q).
4. **Instalador:** somente NSIS (`targets: ["nsis"]`), `installMode: "currentUser"` (instala em `%LOCALAPPDATA%\CSTM`, sem administrador), idioma `PortugueseBR`, atalho no Menu Iniciar. A opção do desinstalador de apagar os dados do aplicativo permanece desmarcada por padrão; se marcada, apaga `%APPDATA%\com.gabriel.cstm` e `%LOCALAPPDATA%\com.gabriel.cstm`. WebView2 no modo padrão do Tauri (baixado se ausente). Sem assinatura digital.
5. **Comportamento de navegador:** somente no build de release, o frontend bloqueia o menu de contexto padrão do WebView2 e os atalhos F5, Ctrl+R, Ctrl+Shift+R, Ctrl+P, Ctrl+F, Ctrl+U e Ctrl+Shift+I. Em campos de texto editáveis, o menu de contexto padrão continua (Recortar, Copiar, Colar, correção ortográfica). Os menus de contexto próprios do app não mudam. Vale para as janelas `main` e `picker`. Os atalhos do app (Ctrl+N, Ctrl+Shift+N, Ctrl+S, Ctrl+A, Ctrl+X/C/V, Ctrl+Z, F2, Del, Alt+Q) foram conferidos em `docs/telas.md` e não conflitam com a lista bloqueada. A detecção de release usa `import.meta.env.PROD`; os testes fixam o modo com `vi.stubEnv('PROD', true/false)`.
6. **Versão:** 0.11.0 (MINOR, funcionalidade compatível, conforme `AGENTS.md`).

## Escopo

- Ícone: `src-tauri/icons/icon.svg` e formatos regenerados em `src-tauri/icons/`; registro do ícone em `docs/telas.md`.
- `tauri.conf.json`: metadados e configuração do NSIS; regras do instalador em `docs/mvp.md`.
- Frontend: bloqueio do comportamento de navegador no release, com testes.
- Documentação: `README.md` (instalação, aviso do SmartScreen, local de instalação e dos dados), `docs/mvp.md`, `CHANGELOG.md`; versão 0.11.0 em `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock` e `tauri.conf.json`.

Fora do escopo: assinatura de código, atualização automática, inicialização com o Windows, instalador MSI, distribuição em loja, renomear o produto.

## Estado desejado

1. Janela, barra de tarefas, bandeja, Menu Iniciar e instalador mostram o ícone "Prancheta", nítido em 16 e 32 px; `icon.ico` contém 16, 24, 32, 48, 64 e 256 px.
2. `npm run tauri -- build` gera apenas o instalador NSIS, em português, que instala em `%LOCALAPPDATA%\CSTM` sem pedir administrador.
3. Reinstalar por cima mantém os dados; desinstalar sem marcar a opção de apagar dados mantém `%APPDATA%\com.gabriel.cstm\cstm.db`.
4. As propriedades do `CSTM.exe` mostram nome, versão 0.11.0, descrição e copyright.
5. Alt+Q e a colagem funcionam no app instalado.
6. No app instalado, F5, Ctrl+R, Ctrl+P, Ctrl+F e o menu de contexto do navegador não têm efeito; o menu de contexto continua em campos de texto; os atalhos do app funcionam.
7. No `npm run tauri -- dev`, nada muda: F5 e o menu de contexto do navegador continuam funcionando.

## Premissas

Confirmadas no planejamento:

- `npx tauri icon` aceita SVG como fonte e gera `.ico` com 16 a 256 px.
- O template NSIS do bundler suporta `PortugueseBR`.
- A caixa de apagar dados do desinstalador começa desmarcada.
- `installMode: "currentUser"` não pede administrador.
- `vi.stubEnv('PROD', ...)` é suportado pelo Vitest 5.

Não confirmada:

- Publisher, copyright e descrição aparecem nas propriedades do `.exe`. Verificada na Fase 2; se não aparecerem, registrar a evidência e pedir decisão ao usuário.

## Riscos

- Sem assinatura, o SmartScreen avisa ao executar o instalador; documentado no README.
- Ícone ilegível em 16 px; mitigado: a opção foi escolhida vendo o tamanho de 16 px no protótipo.
- Bloquear atalhos de navegador pode capturar combinações usadas pelo app; os atalhos do app foram conferidos contra a lista bloqueada, e o teste cobre que eles continuam funcionando.

## Estratégia de validação

- Automatizada: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`; `npm run tauri -- build` gerando somente o instalador NSIS 0.11.0; script (PowerShell ou Node) conferindo os tamanhos do `icon.ico`; inspeção do `.nsi` gerado e de `(Get-Item <exe>).VersionInfo`.
- Funcional no Windows, com o usuário (Marco): instalação sem administrador em português; ícone nas superfícies, inclusive em 16 e 32 px; propriedades do `CSTM.exe`; Alt+Q e colagem; comportamento de navegador no app instalado e no `dev`; reinstalação por cima e desinstalação sem apagar dados.
- Não automatizável: aparência real do ícone e do instalador, e o comportamento do WebView2 instalado; ficam a cargo do Marco.

## Fases

### Fase 1 — Ícone

- [ ] Copiar o SVG da opção A de `docs/prototipo/icone.html` para `src-tauri/icons/icon.svg`.
- [ ] Rodar `npx tauri icon src-tauri/icons/icon.svg`.
- [ ] Registrar o ícone em `docs/telas.md`.

Critério: arquivos gerados em `src-tauri/icons/`; script confirma que `icon.ico` contém 16, 24, 32, 48, 64 e 256 px; `npm run tauri -- build` compila.

### Fase 2 — Metadados e instalador

- [ ] `tauri.conf.json` com `publisher`, `copyright`, `shortDescription` e `longDescription`, `bundle.targets: ["nsis"]` e `windows.nsis` com `installMode: "currentUser"` e `languages: ["PortugueseBR"]`, mais a opção de Menu Iniciar se aplicável.
- [ ] Regras do instalador registradas em `docs/mvp.md`.

Critério: `npm run tauri -- build` gera somente o instalador NSIS (`src-tauri/target/release/bundle/nsis/*.exe`, sem pasta `msi`); o `.nsi` gerado contém `PortugueseBR`, `RequestExecutionLevel user` e a caixa de apagar dados sem estado marcado; `(Get-Item <exe>).VersionInfo` mostra ProductName CSTM, versão 0.11.0, descrição e copyright (se não mostrar, registrar a evidência e pedir decisão).

### Fase 3 — Comportamento de navegador no release

- [ ] Módulo no frontend que bloqueia o menu de contexto padrão (exceto campos editáveis) e os atalhos de navegador, aplicado nas janelas `main` e `picker`.
- [ ] Testes com `vi.stubEnv`: release bloqueia o menu de contexto padrão e os atalhos listados; campos editáveis mantêm o menu de contexto; atalhos do app continuam; dev (`PROD` false) não bloqueia nada.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Documentação e validação técnica

- [ ] `README.md` com instalação, aviso do SmartScreen, local de instalação e dos dados.
- [ ] `docs/mvp.md` com a etapa 7 concluída.
- [ ] `CHANGELOG.md` com `## [0.11.0] - data`.
- [ ] Versão 0.11.0 em `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock` e `tauri.conf.json`.

Critério: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam; `npm run tauri -- build` gera o instalador NSIS 0.11.0.

## Marco — Validação do usuário

- [ ] Instalador em português; instala sem pedir administrador em `%LOCALAPPDATA%\CSTM`.
- [ ] Ícone nítido na janela, na barra de tarefas, na bandeja, no Menu Iniciar e no instalador, inclusive em 16 e 32 px.
- [ ] Propriedades do `CSTM.exe` mostram nome, versão 0.11.0, descrição e copyright.
- [ ] Alt+Q e a colagem funcionam no app instalado.
- [ ] No app instalado, F5, Ctrl+R, Ctrl+P, Ctrl+F e o menu de contexto do navegador não têm efeito; o menu de contexto continua nos campos de texto; os atalhos do app funcionam.
- [ ] No `npm run tauri -- dev`, F5 e o menu de contexto do navegador continuam funcionando.
- [ ] Reinstalar por cima mantém os dados; desinstalar sem marcar a opção de apagar dados mantém `%APPDATA%\com.gabriel.cstm\cstm.db`.

Resultado: pendente.
