# 074 — Inicialização

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Corrigir dois defeitos da inicialização do aplicativo, observados na primeira abertura em outro PC com antivírus corporativo: a tela de cadastro mostra "state not managed" ao chamar comandos antes de o backend estar pronto, e uma falha na inicialização fecha o aplicativo sem nenhuma mensagem.

## Contexto

- No Tauri 2, as janelas declaradas em `tauri.conf.json` (`main` e `picker`) são criadas antes do hook `setup`. É no `setup` (`src-tauri/src/lib.rs`) que se cria a pasta de dados, abre o banco (`db::open`), registra o atalho e faz os `app.manage(...)` do estado.
- Assim, a página da janela pode carregar e chamar `list_folders` antes do `manage` da conexão, e o comando falha com "state not managed". Na máquina de desenvolvimento a inicialização é rápida e o erro não aparece. Quando um antivírus examina o executável novo e o banco que ele cria, a inicialização fica lenta e o erro aparece. Depois que o arquivo passa a ser considerado confiável, o erro some, que foi o que aconteceu.
- Se um passo do `setup` retorna erro (pasta de dados, banco ou ícone da bandeja), o Tauri executa `panic!("Failed to setup app")`. Com `panic = "abort"` no perfil release, o aplicativo fecha sem mensagem. Um arquivo do banco bloqueado por outro processo já basta para isso.
- O registro do atalho já tolera falha: `picker::register_shortcut` guarda `registered: false`, e as Configurações mostram o aviso. Isso não muda.
- O frontend não tem tratamento para "state not managed". A correção fica no backend, sem novas tentativas no frontend.
- Os pontos que procuram as janelas (`tray::show_main_window`, as funções de `picker`, o seletor de arquivos em `commands`) já tratam a janela ausente (`None`). Isso cobre o intervalo antes da criação das janelas, por exemplo um `Alt+Q` ou uma segunda instância durante a inicialização.

## Escopo

1. Criar as janelas `main` e `picker` só ao fim do `setup`, depois de todo o estado registrado:
   - `"create": false` nas duas janelas em `tauri.conf.json`, sem alterar as demais propriedades;
   - no `setup`, criar cada janela com `WebviewWindowBuilder::from_config` a partir de `app.config().app.windows`, preservando a configuração atual.
2. Falha na inicialização: em vez do `panic` silencioso, mostrar uma caixa de mensagem nativa do Windows (`MessageBoxW`, já disponível pela feature `Win32_UI_WindowsAndMessaging`) com o título "CSTM" e um texto do tipo "O CSTM não pôde ser iniciado: <erro>". Depois da mensagem, o aplicativo termina com código de saída 1. A caixa nativa é usada no lugar do plugin de diálogo porque não depende do loop de eventos, que ainda não está rodando durante o `setup`.
3. Fora do escopo: novas tentativas automáticas, log em arquivo, mudança no fluxo do atalho, assinatura digital do executável.

## Estado desejado

- Nenhum comando chamado pelas janelas encontra o estado ausente, qualquer que seja a demora da inicialização.
- Uma falha na inicialização aparece para o usuário com o motivo, em vez de o aplicativo fechar em silêncio.
- Em condições normais, o comportamento é o mesmo de hoje: o cadastro abre visível, o menu fica oculto, e a bandeja, o atalho e a instância única funcionam.

## Riscos

- `from_config` precisa reproduzir exatamente as janelas atuais, inclusive o `picker` transparente, sem bordas e oculto. Uma diferença afetaria o menu em cascata, que foi validado no plano 071. Por isso o Marco revalida o menu.
- A janela `main` aparece um pouco mais tarde, só depois do `setup`. Em condições normais a diferença é imperceptível.
- O caminho de erro só é exercitado provocando uma falha real. Ele é validado na Fase 3 e no Marco.

## Premissas

- O Tauri 2.12 suporta `create: false` em `WindowConfig` e `WebviewWindowBuilder::from_config`.
- O antivírus foi o gatilho do atraso, e não há outro defeito por trás do erro relatado.

## Estratégia de validação

- Automática: `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`, `npm run test` e `npm run build`.
- Técnica, pelo agente:
  - executar o aplicativo com um atraso temporário no `setup` (não commitado) e confirmar que ele chega ao fim da inicialização sem erro;
  - forçar um erro temporário no `setup` e confirmar que a caixa de mensagem aparece e que o processo termina com código 1.
- Manual, pelo usuário, no instalador de teste: abertura normal, menu de colagem e bandeja, e a mensagem de erro com uma falha provocada.

## Fase 1 — Janelas criadas após o setup

- [x] `"create": false` em `main` e `picker` no `tauri.conf.json`.
- [x] No `setup` (`lib.rs`), criar as janelas a partir da configuração depois dos `manage` e da bandeja.
- [x] Comentário explicando por que as janelas são criadas no `setup`.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam. `npm run tauri -- dev` abre o cadastro e o menu (`Alt+Q`) normalmente, conferido por execução e processo ativo sem erros no console.

## Fase 2 — Mensagem de falha na inicialização

- [x] Extrair o corpo do `setup` para uma função que retorna `Result`.
- [x] Em caso de erro, mostrar `MessageBoxW` com o motivo e terminar com `std::process::exit(1)`.

Critério:
- com um erro forçado temporariamente no `setup` (não commitado, para não mexer no banco real em `%APPDATA%`), o processo abre a caixa de mensagem "CSTM", conferida pela janela aberta do processo, e termina com código 1 depois que a caixa é fechada;
- o erro forçado foi removido;
- as verificações automáticas da Fase 1 passam.

## Fase 3 — Validação técnica, documentação e instalador de teste

- [x] Executar o aplicativo com um atraso temporário de alguns segundos no `setup`, confirmar a ausência de "state not managed" e remover o atraso.
- [x] `npm run test`, `npm run build`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check`.
- [x] `CHANGELOG.md` (`Fixed`, em `[Unreleased]`) e documentação afetada, se houver.
- [x] Gerar o instalador de teste e copiá-lo para `releases/teste/` sem substituir arquivos existentes.

Critério: todas as verificações passando, o atraso temporário removido (`git diff` sem ele) e o instalador de teste em `releases/teste/`.

Resultado técnico:
- Com 8 s de atraso no `setup`, o cadastro abriu sem "state not managed", e as janelas `main` (visível) e `picker` (oculta) foram criadas pelo processo.
- Com o erro forçado, apareceu a caixa "CSTM" com o texto "O CSTM não pôde ser iniciado: erro forçado de teste", e o processo terminou com código 1 depois do OK. O código temporário foi removido.
- `npm run test` (146), `npm run build`, `npm run test:rust` (86), `npm run lint:rust` e `cargo fmt --check` passaram.
- Instalador de teste: `releases/teste/CSTM_0.11.1-teste-074-20261014-1055_x64-setup.exe`.
- Nesta máquina, o Alt+Q estava ocupado por outro programa durante os testes, tanto com o código novo quanto com o código anterior. O aviso das Configurações apareceu nas duas versões, então o problema não vem desta mudança.

## Marco — Validação do usuário

- [x] Instalar o instalador de teste por cima da versão atual: o CSTM abre normalmente, sem erro, com os dados preservados.
- [x] `Alt+Q` abre o menu de colagem junto ao cursor, com cascata, busca e colagem funcionando como antes.
- [x] Fechar a janela mantém o CSTM na bandeja, e o ícone reabre o cadastro e as Configurações.
- [x] Com o CSTM fechado ("Sair"), renomear `%APPDATA%\com.gabriel.cstm\cstm.db` e criar uma pasta chamada `cstm.db` no lugar: ao abrir o CSTM, aparece a mensagem de erro e o aplicativo fecha. Depois, apagar a pasta e restaurar o nome do arquivo: o CSTM volta a abrir com os dados.
- [ ] Opcional: abrir o instalador no PC onde o erro apareceu (não informado na validação).

Resultado: validado pelo usuário no instalador de teste `CSTM_0.11.1-teste-074-20261014-1055_x64-setup.exe`; aceite explícito em 2026-10-14.
