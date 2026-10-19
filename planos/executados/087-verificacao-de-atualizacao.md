# 087 — Verificação de atualização

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-19
- Concluído em: 2026-10-19

## Objetivo

Avisar quando houver uma versão nova do CSTM publicada no GitHub, verificando em segundo plano num intervalo escolhido pelo usuário. O aviso leva à página da release; a instalação continua manual, pelo instalador.

## Contexto

- As releases são publicadas no GitHub (`marinsgabriel1997/CSTM`) a partir da 0.16.0, com tag `vX.Y.Z` e o instalador `CSTM_X.Y.Z_x64-setup.exe`; rascunhos e pré-releases não são a "latest".
- O CSTM fica a maior parte do tempo só na bandeja; a janela principal pode passar dias fechada.
- As configurações ficam na tabela `settings` (`db::settings`, chave e valor); a página Configurações tem sete opções.
- O backend ainda não faz nenhuma requisição de rede. A página Sobre já abre o repositório no navegador (`open_repository`, plugin opener).

## Escopo

1. **Verificação em segundo plano:** consulta `https://api.github.com/repos/marinsgabriel1997/CSTM/releases/latest` e compara a `tag_name` com a versão em execução. Roda ao iniciar, se o intervalo já passou desde a última verificação bem-sucedida, e depois continua conferindo de hora em hora se o intervalo venceu. Falhas (sem rede, limite da API, resposta inválida) são silenciosas e tentadas de novo na próxima conferência. No limite da API, a próxima conferência é reagendada para quando o GitHub indicar que o limite volta (`retry-after` ou `x-ratelimit-reset`, com 30 s de folga), entre 1 minuto e 1 hora; sem essa indicação, segue a conferência horária. "Verificar agora" no limite mostra em quantos minutos dá para tentar de novo.
2. **Configurações:** nova seção "Atualizações", depois do histórico do clipboard, com:
   - chave **Verificar atualizações** (ligada por padrão);
   - campo **A cada N dias** (padrão 7, mínimo 1, máximo 90), desabilitado com a chave desligada;
   - botão **Verificar agora**, que mostra o resultado ao lado: "Você está na versão mais recente.", "Versão X disponível." com o botão **Abrir página da release**, ou o erro.
3. **Notificação do Windows:** ao encontrar uma versão nova na verificação em segundo plano, mostra um toast uma única vez por versão ("CSTM X disponível — clique para abrir a página da release"). Clicar abre a página da release no navegador.
4. **Barra na janela principal:** enquanto houver versão nova, uma barra no topo da janela de cadastro mostra "Versão X disponível" com **Abrir página da release** e **Dispensar**. Dispensar esconde a barra para aquela versão; uma versão mais nova mostra a barra de novo.
5. **Comparação de versão:** `X.Y.Z` numérica; o sufixo de pré-release da versão em execução (ex.: `-teste-087`) é ignorado. Tag fora do formato `vX.Y.Z` é tratada como falha.

Fora do escopo: baixar ou instalar a atualização automaticamente (plugin updater), item no menu da bandeja, aviso na página Sobre, canal de pré-releases.

## Estado desejado (técnico)

- Dependência nova no Rust: `ureq` (cliente HTTP síncrono, com TLS rustls), com timeout de 15 s e `User-Agent: CSTM/<versão>`, exigido pela API do GitHub.
- Novo módulo `update` no backend: consulta, comparação de versões (função pura, testada), agendamento numa thread própria e emissão do evento `update-available` para a janela `main`.
- `db::settings`: chaves `update_check` (`on`/`off`), `update_interval_days`, `update_last_check` (Unix, segundos), `update_latest` (última release encontrada, versão e URL em JSON, para a barra sobreviver ao reinício), `update_notified` (última versão avisada por toast) e `update_dismissed` (última versão dispensada na barra), com leitura tolerante a valores inválidos (volta ao padrão).
- Comandos: `get_update_settings`, `set_update_settings(enabled, interval_days)`, `check_update_now` (retorna versão atual, versão encontrada, URL da release e se é mais nova), `get_available_update` (para a barra ao abrir a janela), `dismiss_update(version)` e `open_release(url)` (só aceita URLs de `https://github.com/marinsgabriel1997/CSTM/releases/`).
- Toast pela API WinRT do Windows via crate `windows` (features `UI_Notifications` e `Data_Xml_Dom`), com `activationType="protocol"` e `launch` igual à URL da release: o clique abre o navegador sem precisar de tratamento no aplicativo. AppUserModelID igual ao `identifier` (`com.gabriel.cstm`), que o instalador NSIS do Tauri grava no atalho.
- Frontend: `api.ts` e `fakeApi.ts`; seção nova em `SettingsPage.tsx`; barra em `App.tsx` (ou componente próprio), escutando `update-available`.

## Riscos

- **Toast sem atalho registrado:** em `npm run tauri -- dev` o AppUserModelID não está associado a um atalho e o Windows pode não exibir o toast. A validação do toast é feita no build instalado; a barra e as Configurações funcionam em qualquer modo. Se o toast não aparecer nem no instalado, registrar a evidência e pedir decisão (por exemplo, `tauri-plugin-notification`, sem ação no clique).
- **Primeira requisição de rede do aplicativo:** firewall ou proxy podem bloquear; a falha é silenciosa em segundo plano e explícita no "Verificar agora". A Ajuda e o `docs/produto.md` passam a dizer que o CSTM consulta o GitHub e o que é enviado (só a requisição com o `User-Agent`).
- **Limite da API sem autenticação** (60 por hora por IP, compartilhado com outros programas na mesma rede): uma consulta por intervalo, mais as manuais, fica muito abaixo; se ainda assim o limite for atingido, a verificação é reagendada para quando ele volta.
- **Tamanho do executável:** `ureq` com rustls acrescenta algumas centenas de KB; aceitável.
- **Validação do aviso:** a release mais recente publicada precisa ser mais nova que a versão instalada. O aviso só é validado depois da publicação da 0.18.0 (esta entrega) e da release seguinte (plano 086), com a 0.18.0 instalada (ver Premissas).

## Premissas

- A versão em execução vem de `app.package_info().version`, que segue o `tauri.conf.json` (ou o `--config` do build).
- O Marco tem duas etapas: antes da publicação, com o build `0.18.0-teste-087` (Configurações, Verificar agora, falta de rede, Ajuda); depois, com a 0.18.0 publicada e instalada, quando a release do plano 086 for publicada (toast, barra e Dispensar). O plano só é concluído após a segunda etapa. A release do 086 traz a migração 0005, que a 0.18.0 não abre (`DatabaseTooFarAhead`): na máquina da segunda etapa, o `cstm.db` é copiado antes de instalar o build de teste do 086 e restaurado ao reinstalar a 0.18.0 (ou o 086 é testado em outra máquina).
- Mudar a chave ou o intervalo não dispara verificação imediata; vale na próxima conferência horária.

## Estratégia de validação

- Rust: `npm run test:rust` (comparação de versões, leitura da tag, configurações e regra do intervalo, sem rede), `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`.
- Frontend: `npm run test`, `npm run build`, `npm run lint`.
- Funcional no Windows: Marco, com o build instalado.

## Fase 0 — Desenho

- [x] `docs/telas.md`: seção Atualizações na Tela 3 (agora com oito configurações) e barra de versão nova na Tela 1.
- [x] `docs/prototipo/` atualizado nas telas afetadas.

Critério: desenho registrado e coerente com o escopo.

## Fase 1 — Backend

- [x] `ureq` em `Cargo.toml` e features WinRT no `windows`; `Cargo.lock` atualizado pelo cargo.
- [x] Configurações em `db::settings`, com testes de padrão, limites e valores inválidos.
- [x] Módulo `update`: comparação de versões e leitura da `tag_name`/`html_url`, com testes; regra "intervalo venceu" como função pura testada.
- [x] Agendamento em thread iniciada no `setup`, toast uma vez por versão e evento `update-available`.
- [x] Comandos registrados; `open_release` recusa URLs fora das releases do repositório (teste).

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passando.

## Fase 2 — API e fakeApi

- [x] Tipos e comandos em `src/api.ts`; `src/test/fakeApi.ts` coerente (configurações, verificação simulada, dispensa).

Critério: `npm run build` passando.

## Fase 3 — Interface

- [x] Seção Atualizações em `SettingsPage.tsx`: chave, campo de dias com limites, Verificar agora e resultados.
- [x] Barra na janela principal: aparece com versão nova, abre a release, Dispensar some até a próxima versão.
- [x] Testes em `App.test.tsx` (configurações e barra, junto dos testes das demais configurações).

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

## Fase 4 — Documentação

- [x] `docs/produto.md` (módulo `update`, dependência `ureq`, consulta ao GitHub), `src/helpContent.ts` (seção Configurações) e `CHANGELOG.md` (`Added`).

Critério: documentação revisada e coerente com o código.

## Fase 5 — Reagendamento no limite da API

- [x] Leitura de `retry-after` e `x-ratelimit-reset` em respostas 403/429 (função pura testada) e próxima conferência da thread no horário indicado, com 30 s de folga, entre 1 minuto e 1 hora.
- [x] Mensagem de "Verificar agora" no limite com os minutos até a nova tentativa.
- [x] `docs/produto.md` (as mensagens de `docs/telas.md` e a Ajuda não mudam).

Critério: `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`, `npm run test` e `npm run build` passando.

## Marco — Validação do usuário

- [x] Configurações: a seção Atualizações aparece; a chave desabilita o campo; o campo não aceita menos de 1 nem mais de 90 dias; os valores persistem após reiniciar.
- [x] Verificar agora no build `0.18.0-teste-087`: "Você está na versão mais recente."
- [x] Sem internet, Verificar agora mostra o erro e nada aparece em segundo plano.
- [x] A Ajuda descreve a verificação de atualização.
- [x] Depois da publicação da release do plano 086, com a 0.18.0 instalada: ao iniciar (ou na conferência horária), aparece o toast uma vez; clicar abre a página da release no navegador.
- [x] Reiniciar não repete o toast.
- [x] A barra aparece na janela principal; Abrir página da release funciona; Dispensar esconde e ela não volta ao reiniciar.

Resultados:

- 2026-10-19, build `0.18.0-teste-087`: Configurações, Verificar agora (versão mais recente, com a 0.17.0 publicada), falta de rede e Ajuda validados pelo usuário. Toast, barra e Dispensar pendentes até a publicação da release do plano 086.

- 2026-10-19: toast, abertura da página da release, toast sem repetir ao reiniciar, barra e Dispensar validados pelo usuário com as releases publicadas.

Aceite: todas as verificações aprovadas pelo usuário em 2026-10-19.
