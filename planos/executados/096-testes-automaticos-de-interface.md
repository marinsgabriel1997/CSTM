# 096 — Testes automáticos de interface no aplicativo real

- Status: Em execução
- Prioridade: Média
- Criado em: 2026-11-22

## Objetivo

Testar automaticamente o CSTM compilado, com cliques, teclado, banco real e integração com o Windows (atalho global, foco, colagem e clipboard). Assim o agente valida sozinho a maior parte do que hoje vai para o Marco, e ficam manuais só as verificações que não dá para automatizar.

## Contexto

- Os testes atuais (Vitest, jsdom, Testing Library e `user-event`) simulam a interface com `src/test/fakeApi.ts`; não cobrem o Tauri, o SQLite, as janelas reais nem o Windows.
- A pasta de dados vem do identificador `com.gabriel.cstm` (`app_data_dir`, `src-tauri/src/lib.rs`), o mesmo do CSTM instalado do usuário (`%LOCALAPPDATA%\CSTM\cstm.exe`, em execução). A instância única (`tauri-plugin-single-instance`) também usa o identificador, e o CSTM instalado ocupa `Alt+Q`.
- O WebView2 (157) aceita a porta de depuração CDP pela variável `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` do processo, o que permite controlar as janelas `main` e `picker` sem driver.
- `scripts/ajuda-imagens.mjs` já controla o Edge por CDP para as imagens da Ajuda; não é reaproveitado aqui.

## Decisões tomadas com o usuário

- Duas camadas: **app real** (telas pelo Playwright via CDP do WebView2) e **Windows de ponta a ponta** (atalho, foco, colagem e clipboard com teclado e mouse de verdade).
- Ferramenta: Playwright (biblioteca e executor de testes, dependência só de desenvolvimento), conectado por CDP, sem `tauri-driver` nem `msedgedriver`.
- Cobertura: tudo o que for automatizável já nesta entrega.
- O teste do Windows roda **só quando o usuário pedir**. Quando o agente precisar dele numa validação, avisa o usuário antes de rodar (o teste usa teclado e mouse); essa regra fica registrada em `AGENTS.md` e `docs/agente/validacao.md`.
- Isolamento do teste do Windows: **fechar o CSTM instalado** durante o teste, usar o `Alt+Q` padrão e reabrir o CSTM instalado no fim (se estava aberto).
- "Iniciar com o Windows" e a verificação de atualizações ficam **manuais**, sem desvio no código.
- A colagem é conferida numa **janela de teste própria**, aberta pelo teste, com caixa de texto; o teste lê o texto colado e o clipboard (texto e HTML).

## Decisões de execução

- Build de teste com identificador próprio, `com.gabriel.cstm.teste`, passado só na linha de comando (`--config`), sem mudar o código nem a configuração do app: pasta de dados e instância separadas das do usuário. Build `--debug --no-bundle` em `src-tauri/target/debug/`.
- Antes de cada execução, o teste apaga só as pastas `%APPDATA%\com.gabriel.cstm.teste` e `%LOCALAPPDATA%\com.gabriel.cstm.teste`; o código recusa apagar qualquer outro caminho. Os dados do usuário (`com.gabriel.cstm`) nunca são lidos nem alterados.
- A camada do app não usa teclado, mouse nem clipboard reais (só eventos CDP) e não fecha o CSTM instalado; pode rodar em qualquer validação. Como o `Alt+Q` pode estar ocupado, ela não depende do atalho.
- Tudo o que lê ou escreve o clipboard fica na camada do Windows, para não mexer no clipboard do usuário fora dela.
- Entrada real (`SendInput`), janela de teste, clipboard (texto, HTML, imagem e formato sensível) e diálogos nativos de arquivo por um helper em PowerShell com `Add-Type`, sem dependência nova.
- O app consulta o GitHub 10 s após abrir quando nunca verificou, o que aconteceria a cada banco novo. O suporte dos testes desliga as atualizações pelo comando do próprio app (`set_update_settings`) logo ao abrir, para nenhum teste fazer requisição de rede nem gastar o limite da API.
- Seletores por papel e nome acessível (`getByRole`, `getByText`), sem `data-testid`. Se algum fluxo exigir mudança no app, consultar o usuário antes.
- Arquivos: `e2e/` (configuração do Playwright, `e2e/app/`, `e2e/windows/`, `e2e/support/`) e scripts `e2e:build`, `test:app` e `test:windows` no `package.json`.
- Sem incremento de versão nem instalador: a entrega é só de ferramentas de teste, sem impacto no software distribuído.

## Escopo

**Camada do app (`npm run test:app`)**
- Cadastro: criar, editar, renomear (`F2`) e excluir textos e pastas, subpastas, Raiz e seleção vazia, favoritos, busca e filtro de favoritos, contador de uso.
- Árvore: seleção múltipla, recortar, copiar e colar, `Ctrl+Z`, arrastar e soltar (ordem, pasta e `Ctrl` para copiar), ordenação por nome, mais usados e uso recente, navegação por teclado.
- Lixeira: `Delete`, `Shift+Delete` com confirmação, Restaurar e Esvaziar lixeira.
- Persistência: fechar e reabrir o app com os dados mantidos; posição e tamanho da janela lembrados.
- Configurações: atalho, navegação nas pastas, tema, modo de colagem padrão, Depois de colar, histórico (ligar e desligar) e intervalo de atualizações, todos lembrados após reiniciar.
- Ajuda (abre na primeira execução, abas, `F1`) e Sobre (versão e pasta dos dados).
- Menu de colagem aberto pelo backend: Mais usados, Favoritos, pastas em cascata e no modo clique, busca, teclado (`↑`, `↓`, `→`, `←`, `Esc`) e botões de modo na linha selecionada.

**Camada do Windows (`npm run test:windows`)**
- `Alt+Q` abre o menu junto ao cursor; `Esc` e clique fora fecham sem colar.
- Colagem na janela de teste nos quatro modos, com o texto e o HTML do clipboard conferidos; Copiar e `Ctrl+C` sem colar.
- Depois de colar: manter o que foi colado e restaurar o conteúdo anterior (texto, HTML e imagem), incluindo o caso em que o clipboard mudou antes dos 500 ms.
- Histórico: textos, HTML e imagens copiados aparecem no menu e no cadastro, colam com os formatos, sobem ao topo, vão para a Lixeira e voltam; desligar e Limpar histórico; itens sensíveis e os escritos pelo próprio CSTM não entram.
- Troca do atalho vale na hora.
- Fechar a janela principal só a oculta, com o atalho ativo; abrir o app de novo traz a instância existente.
- Bandeja pela UI Automation, se for estável; senão, fica manual com o motivo registrado.
- Importar `.txt`, pasta, conteúdo de pasta e backup JSON, e exportar pastas com `.txt` e backup JSON, pelos diálogos nativos, em pastas temporárias (inclui UTF-8 e arquivos ignorados).

**Documentação**
- `AGENTS.md` (comandos e regra do aviso), `docs/agente/validacao.md` (quando rodar cada camada e o que fica manual), `docs/agente/ambiente.md` (cuidados do ambiente) e `CHANGELOG.md`.

**Continuam manuais:** aparência e layout, UIPI (programa como administrador), vários monitores e escalas, Iniciar com o Windows, atualizações (notificação e barra), formatação no Word/Outlook/Gmail/Teams, instalador e desinstalador.

## Estado desejado

- `npm run e2e:build` gera o build de teste; `npm run test:app` e `npm run test:windows` passam e relatam por fluxo o que foi verificado.
- O CSTM instalado e os dados do usuário saem intactos de qualquer execução.

## Riscos e premissas

- Premissa: o WebView2 do Tauri aceita `--remote-debugging-port` pela variável de ambiente e expõe as duas janelas como páginas CDP. Se não aceitar, consultar o usuário antes de trocar de ferramenta.
- O `Alt+Q` gerado por `SendInput` precisa acionar o `RegisterHotKey`; se não acionar, registrar a evidência e consultar.
- A janela `picker` é transparente e recortada; cliques reais fora das colunas atravessam para trás, como devem.
- Um clipboard alterado por outro programa durante o teste do Windows pode causar falhas; por isso o teste toma o PC e o aviso é obrigatório.
- Arrastar e soltar e os diálogos nativos são os pontos mais frágeis; uma falha instável é corrigida ou registrada, nunca ignorada com novas tentativas automáticas.
- Se o teste do Windows parar no meio, o CSTM instalado pode ficar fechado; o teste o reabre também em caso de falha, e o relatório diz se precisou fazer isso.

## Estratégia de validação

- Cada fase roda as suas specs até passarem três vezes seguidas.
- `npm run lint` (cobrindo `e2e/`), `npm run build` e `npm run test` continuam passando.
- O teste do Windows é rodado pelo agente só depois de avisar o usuário e ter a confirmação dele.

## Fase 1 — Infraestrutura

- [x] `@playwright/test` como dependência de desenvolvimento, sem baixar navegadores.
- [x] `npm run e2e:build` com o identificador de teste.
- [x] Suporte: abrir o build com a porta CDP, conectar às janelas `main` e `picker`, limpar as pastas de teste (com a trava de caminho) e encerrar o app.
- [x] Teste de fumaça: o cadastro abre com a Ajuda da primeira execução.
- Critério: fumaça passa três vezes seguidas; `npm run lint` passa. ✔ (também `@types/node` como dependência de desenvolvimento; `vite.config.ts` exclui `e2e/**` do Vitest)

## Fase 2 — Camada do app

- [x] Specs de cadastro, árvore, lixeira, persistência, configurações, Ajuda e Sobre e menu de colagem.
- Critério: `npm run test:app` passa três vezes seguidas, com o CSTM instalado aberto. ✔ 82 testes passando e 4 adiados (`test.fixme`), cerca de 2,7 min por execução.
- Resultado:
  - Os dados de teste são criados pelos comandos do app (`create_folder`, `create_snippet`). `reiniciar()` sai pelo `exit_app`.
  - Mover, redimensionar e fechar a janela usam a API do Windows sobre o PID do processo de teste (`e2e/support/janela.ts`), porque as capabilities não expõem esses comandos.
  - O menu de colagem é aberto pelo evento `picker-opened`, sem o atalho. Uma trava na página recusa os comandos que colam ou escrevem no clipboard.
  - Adiados para a camada do Windows: o contador "Usado N vezes", que só sobe ao colar ou copiar, e as colunas da cascata (hover e `→`), que dependem da abertura real do menu (`layout_picker`).
  - Possível bug do app, adiado com `test.fixme`: na primeira vez, "Ver como importar" não deixa "Importar e exportar" na área visível, porque as imagens `loading="lazy"` ainda não têm altura. Fica para o usuário decidir se vira issue.

## Fase 3 — Helper do Windows

- [x] Helper PowerShell: `SendInput` (teclas e mouse), janela de teste com leitura do texto, clipboard (ler e escrever texto, HTML, imagem e formato sensível), diálogos de arquivo e fechar e reabrir o CSTM instalado.
- [x] Teste de fumaça: `Alt+Q` abre o menu do build de teste e um texto é colado na janela de teste.
- Critério: fumaça passa três vezes seguidas, rodada após aviso ao usuário. Para poupar interrupções, as duas rodadas que faltam contam nas execuções da Fase 4, que incluem a fumaça.
- Resultado:
  - 1ª execução: o helper morreu ao abrir (`spawn` com `detached` no Windows). Ao fim, nenhum CSTM rodava, e o orquestrador reabriu o instalado com `--autostart`. Não se sabe se ele já estava fechado antes.
  - Correção: o helper tem de responder e o clipboard tem de estar salvo antes de qualquer fechamento. O Node reabre o CSTM no teardown, nos sinais e no `exit`. O estado da sessão fica em arquivo (`sessao.json`), e uma execução seguinte restaura uma sessão pendente. Há também o ensaio sem efeitos (`CSTM_E2E_ENSAIO=1`).
  - 2ª execução: fumaça passou. O clipboard voltou idêntico (8 formatos) e o CSTM instalado voltou na bandeja.

## Fase 4 — Camada do Windows

- [x] Specs de atalho, colagem e modos, Depois de colar, Histórico, troca de atalho, janela oculta e instância única, bandeja (ou registro do motivo) e importar e exportar.
- Critério: `npm run test:windows` passa três vezes seguidas, rodada após aviso ao usuário; o CSTM instalado volta aberto e com os dados intactos.
- Andamento: 8 specs escritas, com 34 testes (a fumaça incluída). O ensaio passa, e `npm run test:app` passou três vezes seguidas, depois de corrigida a espera do `picker_ready` em `reabrir()`. - 1ª rodada completa: 27 falhas, das quais 22 vieram da detecção do menu fechado. `document.hasFocus()` continua verdadeiro com a janela oculta.
  - A bandeja não achou o ícone, que fica na área de ícones ocultos.
  - No seletor de pasta, o caminho completo foi digitado no campo de nome, e o diálogo de erro travou o PC. O orquestrador encerrou só o build de teste.
  - A sessão funcionou: o CSTM instalado já estava fechado, e o clipboard voltou idêntico.
- Correções:
  - O menu é detectado pela janela visível do processo.
  - A bandeja abre o painel de ícones ocultos.
  - Os diálogos navegam pela barra de endereço, e uma falha fecha os diálogos na hora.
  - O tempo máximo de cada teste caiu para 60 s.
- Rodadas seguintes, todas autorizadas pelo usuário antes de começar:
  - 2ª: 27/34. Falharam o ícone da bandeja (animação do painel), o clipboard ocupado, a seleção de vários arquivos, dois localizadores que pegavam também a região `aria-live` do Fluent e uma exceção de UI Automation no diálogo.
  - 3ª: o diálogo de salvar abriu em Documentos e recebeu um caminho no campo Nome; a caixa de erro travou o PC e o orquestrador encerrou só o build de teste. Nenhum arquivo do usuário foi alterado (conferido). Correção: os diálogos só recebem nome simples depois de conferida a pasta temporária do teste; sem a conferência, o diálogo é cancelado; caixas de erro fecham na hora; nenhuma operação do helper passa de 10 s.
  - 4ª: 31/34. A trava cancelou dois diálogos porque a UI Automation não expõe o caminho; a pasta passou a ser lida pela barra "Endereço:" (Win32).
  - 5ª: 33/34. O campo Nome passou a ser preenchido direto no controle (`WM_SETTEXT` e `BM_CLICK`), sem teclado.
  - 6ª: 34/34, em 2,5 min, com o clipboard restaurado idêntico.
  - 7ª: 32/34. A pasta de dados do app de teste ainda estava presa pelo processo anterior (`EPERM`). Correção: o encerramento espera o processo e os WebView2 do teste saírem, e a limpeza tenta de novo; `npm run test:app` continuou passando (82).
- Decisão do usuário (2026-11-22): o critério de três rodadas seguidas foi dispensado. A 6ª rodada passou inteira e a falha da 7ª era da limpeza entre testes, já corrigida; não rodar mais rodadas só para cumprir a contagem.

## Fase 5 — Documentação

- [x] `AGENTS.md`, `docs/agente/validacao.md`, `docs/agente/ambiente.md` e `CHANGELOG.md`.
- [x] `npm run lint`, `npm run build` e `npm run test` passam. ✔ lint limpo, build ok e 298 testes do Vitest passando; `tsc` do `e2e/` limpo.
- Critério: documentos atualizados e validações passando.

## Marco — Validação do usuário

- [x] Acompanhar uma execução de `npm run test:windows` (rodada pelo agente após o aviso) e confirmar que o PC volta ao normal, com o CSTM instalado aberto e os textos intactos.
- [x] Rodar `npm run test:app` e conferir que o relatório é claro.
- [x] Conferir a lista do que continua manual e a regra do aviso em `AGENTS.md`.

Resultados: `npm run test:windows` com 34/34 na 6ª rodada (clipboard restaurado idêntico); `npm run test:app` com 82 passando e 4 adiados; lint, build e Vitest (298) passando.

Aceite: Marco aceito pelo usuário em 2026-11-22.
