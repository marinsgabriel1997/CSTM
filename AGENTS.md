# Instruções do projeto CSTM

## Contexto e escopo

- CSTM é um aplicativo desktop para cadastrar, organizar e colar textos reutilizáveis por meio de um menu flutuante e atalho global.
- O produto tem como alvo o Windows; o MVP foi concluído e `docs/produto.md` descreve as funcionalidades atuais. Expansão por abreviação, transformações de texto, variáveis e suporte a Linux/macOS estão fora do escopo documentado. O histórico do clipboard (plano 077) guarda textos, formatação HTML/RTF e imagens; o cadastro continua só com textos.
- A stack atual é React 19, TypeScript 6, Vite 8, Fluent UI React v9, Tauri 2 e Rust edição 2024. A interface usa componentes, tokens e `makeStyles` do Fluent UI.
- `src/` contém o frontend; `src-tauri/` contém o backend e a configuração desktop; `docs/produto.md` descreve as funcionalidades, o escopo e a arquitetura.
- Não tratar como implementado o que só estiver em planos ou no roadmap do README.

## Ambiente e comandos

- Usar os scripts existentes em `package.json`, preservando `package-lock.json` e `src-tauri/Cargo.lock` conforme as dependências efetivamente alteradas.
- `npm run dev`: iniciar somente o frontend Vite.
- `npm run build`: verificar TypeScript e gerar o build do frontend com Vite.
- `npm run preview`: visualizar o build do frontend.
- `npm run tauri -- dev`: iniciar o aplicativo desktop em desenvolvimento; a configuração Tauri chama `npm run dev`.
- `npm run tauri -- build`: construir o aplicativo desktop; a configuração Tauri chama `npm run build`.
- A configuração Vite usa a porta fixa 1420. Verificar os requisitos locais de Node, Rust e ferramentas Windows antes de executar o fluxo desktop.
- `npm run lint`: executar o ESLint no frontend.
- `npm run lint:rust`: executar o clippy no backend com warnings tratados como erro.
- `npm run format:rust`: formatar o backend com `cargo fmt`; `cargo fmt --check` em `src-tauri/` verifica sem alterar.
- O projeto não inclui formatador de frontend; não adicionar Prettier ou equivalente sem aprovação.
- `npm run test`: executar os testes do frontend com Vitest (jsdom e Testing Library). Os testes substituem `src/api.ts` pela implementação em memória de `src/test/fakeApi.ts` e não cobrem a integração real com o Tauri.
- `npm run test:rust`: executar os testes do backend com `cargo test`.
- `npm run ajuda:imagens [captura ...]`: regenerar as imagens da Ajuda (`src/assets/ajuda/`) a partir dos protótipos, com o Edge sem janela; as capturas, com estado, recorte e marcações, ficam em `scripts/ajuda-imagens.mjs`.

## Modos e fluxo de trabalho

- Planejamento: ler código e documentos relevantes e esclarecer com o usuário, antes de registrar o plano, todas as dúvidas e decisões possíveis (solução, escopo, comportamento, textos visíveis, riscos aceitos), de modo que o plano possa ser executado até o Marco sem novas consultas; não implementar antes de concluir esse esclarecimento.
- Execução: registrar o plano e, em seguida, executar suas fases continuamente até o Marco, em mudanças incrementais, atualizando o andamento e realizando as validações previstas, sem pedir aprovação do plano nem aceites intermediários.
- Revisão: inspecionar código, diff e critérios de aceite somente em leitura; relatar problemas sem corrigir arquivos por iniciativa própria.
- Alinhar o modo com o usuário quando a ambiguidade alterar as permissões da tarefa.
- Apresentar decisões e dúvidas ao usuário como perguntas interativas com as opções disponíveis (ferramenta de perguntas do cliente), indicando a recomendada, em vez de listá-las só em texto corrido.
- O plano serve de registro histórico das decisões e de checklist das validações técnicas e do Marco; não é apresentado para aprovação antes da execução.
- Mudanças relevantes de escopo, arquitetura ou contratos que surjam durante a execução e não tenham sido decididas no planejamento exigem consulta ao usuário antes de executar a parte afetada.
- Após implementar e validar tecnicamente a entrega, atualizar a documentação afetada e registrar mudanças notáveis; gerar sempre o instalador de teste em `releases/teste/` (ver Versionamento) e apresentar o Marco final com o caminho do instalador, para validação exclusiva do usuário, incluindo verificações no Windows quando necessárias. O plano só é concluído após aceite explícito do Marco.
- Não realizar commit sem autorização explícita específica para a operação. Push e pull seguem a seção Envio ao GitHub.

## Delegação a subagentes

- O agente principal atua como orquestrador: define e edita contratos, planos e documentação, divide o trabalho em tarefas, revisa os resultados e executa as validações finais.
- A implementação é delegada a subagentes, escolhidos conforme a complexidade: Haiku para tarefas mecânicas e bem delimitadas (ajustes pontuais, renomeações, testes simples, verificações); Sonnet para tarefas que exigem raciocínio sobre o código (componentes, integração, diagnóstico de falhas).
- Cada tarefa delegada tem escopo fechado: objetivo, arquivos que podem ser alterados, contratos e convenções a seguir, o que não deve ser tocado e critério de conclusão verificável. Subagentes não decidem escopo, arquitetura ou contratos, não editam planos nem documentação e não fazem commit.
- O orquestrador revisa o diff de cada tarefa antes de seguir; alterações fora do escopo pedido são descartadas e a tarefa é refeita.

## Planos

- Manter planos ativos em `planos/` e concluídos em `planos/executados/`. Nomear novos planos no formato `NNN-nome-descritivo.md`, por exemplo `001-autenticacao.md`, com ID numérico sequencial, permanente e não reutilizável; o ID não representa prioridade.
- Antes de criar um plano, consultar os IDs em `planos/` e `planos/executados/` para escolher o próximo ID livre, sem reaproveitar IDs de planos excluídos conhecidos. Preservar nomes e referências dos planos legados `p10-`, `p67-` e similares; não renomeá-los automaticamente. Migração exige proposta separada.
- Registrar no início do plano `Status`, `Prioridade` (Crítica, Alta, Média ou Baixa) e `Criado em`; preencher `Concluído em` somente após aceite. Alterar prioridade pelo metadado, sem renomear o arquivo nem criar subpastas por prioridade, módulo ou status por padrão.
- Cada plano deve ser autocontido e registrar objetivo, contexto, decisões tomadas com o usuário, escopo, estado desejado, riscos, premissas e estratégia de validação.
- Dividir a execução em fases numeradas, na ordem de execução, com tarefas verificáveis e critério técnico objetivo de conclusão verificável pelo agente; marcar tarefas concluídas somente após confirmar sua execução.
- Após registrar o plano, executar as fases continuamente, sem pausas de aceite intermediárias; não avançar à fase seguinte antes de atender ao critério técnico da fase atual.
- Manter uma única seção `Marco — Validação do usuário`, persistente e sempre a última seção do arquivo, abaixo de todas as fases. Conter checklist das verificações funcionais/manuais do usuário, resultados e aceite explícito; somente o usuário pode validar e aprovar essas verificações.
- Após reprovação ou ajustes, registrar resultados e pendências no mesmo Marco e acrescentar fases corretivas numeradas imediatamente antes dele, preservando fases concluídas e o histórico das validações. Executar as correções e retornar ao mesmo Marco, sem criar outro Marco ou novo plano para a mesma entrega.
- Correções dentro do escopo do plano não exigem consulta. Nova funcionalidade, decisão arquitetural material, risco novo relevante ou ampliação de escopo exigem consulta ao usuário e atualização do plano antes de executar a parte afetada.
- Se surgir impedimento real sem solução autorizada ou validação técnica inviável, registrar evidências e solicitar decisão; não fabricar resultados nem avançar como se aprovado.
- Somente após aceite explícito de todas as verificações aplicáveis no Marco, registrar `Concluído em`, marcar `Status: Concluído` e mover o plano para `planos/executados/`, preservando seu ID e nome. Terminar as fases técnicas não conclui o plano.
- Manter o plano atualizado com o estado técnico real; não registrar histórico de conversa, instruções ao próximo agente ou duplicações destas regras.

## Arquitetura e contratos

- Preservar a divisão frontend/backend e a comunicação por comandos Tauri. O frontend não deve executar SQL.
- A arquitetura separa banco/migrações (`db`), comandos (`commands`), menu (`picker`), colagem Windows (`paste`), bandeja (`tray`) e os demais módulos descritos em `docs/produto.md`. Criar módulos novos somente no escopo aprovado.
- As janelas planejadas são `main` para cadastro e `picker` para seleção flutuante; a presença no documento não comprova sua existência no código.
- Respeitar os contratos aprovados para pastas, snippets, busca, ordenação, favoritos e persistência SQLite.
- Preservar a intenção do fluxo de colagem: guardar a janela ativa, selecionar o texto, ocultar o menu, restaurar foco, colar e, conforme a configuração "Depois de colar" (plano 084), manter o que foi colado (padrão) ou restaurar o conteúdo anterior do clipboard.
- Considerar as limitações documentadas de UIPI, entrada simulada e perda de formatos não textuais do clipboard ao definir comportamento e critérios de aceite.
- O atalho padrão é `Alt+Q`, configurável pelo usuário na tela de configurações (p55), e o menu abre junto ao cursor do mouse (p50); mudar esses comportamentos exige nova aprovação.
- Com "Restaurar o conteúdo anterior", o clipboard é restaurado 500 ms após o `Ctrl+V` simulado e somente se ainda contiver o texto colado (p60); mudar esse intervalo exige nova validação no Windows.
- Não adicionar funcionalidades paralelas, substituir a arquitetura ou reescrever módulos inteiros quando uma alteração limitada resolver a tarefa.

## Qualidade e nomenclatura

- Seguir as convenções existentes de React/TypeScript e Rust; manter TypeScript estrito.
- Usar nomes claros e vocabulário consistente para os mesmos conceitos; manter responsabilidades bem definidas.
- Preferir código simples e explícito; evitar duplicações e abstrações sem benefício concreto.
- Preservar os padrões locais ao editar código. Mudanças de convenção devem ser intencionais e aprovadas.
- Usar comentários para explicar decisões e contexto não evidentes, sem repetir o código.

## Documentação, fontes e governança

- Atualizar a documentação diretamente afetada e separar conhecimento técnico permanente de contexto transitório da conversa.
- Toda mudança visível ao usuário (funcionalidade, atalho, nome de botão ou fluxo) atualiza na mesma entrega o conteúdo da Ajuda do aplicativo, em `src/helpContent.ts`. Quando a mudança altera uma tela mostrada nas imagens da Ajuda, atualizar o protótipo, regenerar as imagens afetadas com `npm run ajuda:imagens` e conferi-las, seguindo `docs/ajuda.md`.
- Código e configuração representam o estado implementado; `docs/produto.md` orienta o escopo do produto; o plano aprovado define a entrega em andamento.
- Este `AGENTS.md` define comportamento e processo do agente. Não transformar sugestões ou decisões abertas da documentação em contratos confirmados.
- Identificar conflitos entre fontes antes de prosseguir na parte afetada; não presumir que documentação descreve fielmente o código atual.
- Manter regras comuns neste arquivo da raiz. Não criar instruções aninhadas sem necessidade de escopo distinto e aprovação dessa organização.
- Antes de reorganizar instruções, inspecionar os arquivos aplicáveis e preservar o significado das regras válidas; não assumir precedência universal entre clientes.
- Não criar nem sincronizar `CLAUDE.md` por padrão; evitar duplicar regras em vários documentos.
- Usar Markdown UTF-8, preservando acentos e permitindo Unicode quando adequado ao contexto.

## Testes e validação

- Criar ou atualizar testes para toda mudança de comportamento testável; definir no plano a infraestrutura necessária quando ela ainda não existir.
- Preservar testes como contratos de comportamento; investigar falhas antes de alterá-los, sem ajustar expectativas apenas para obter sucesso.
- Testar comportamento e contratos, evitando acoplamento desnecessário a detalhes internos.
- Definir critérios de aceite objetivos durante o planejamento e executar testes e verificações oficiais aplicáveis à mudança.
- Para alterações de frontend, executar `npm run test` e `npm run build` (tipos e build); isso não substitui validação funcional no aplicativo desktop.
- Manter `src/test/fakeApi.ts` coerente com os contratos dos comandos usados pela interface.
- Validar alterações de backend e integração desktop com verificações adequadas ao Rust/Tauri, relatando os comandos efetivamente executados e seus resultados.
- Atalho global, foco, clipboard, entrada simulada, bandeja e instância única exigem validação funcional no Windows quando afetados.
- Distinguir verificações automatizadas de testes manuais e registrar o que não pôde ser validado.
- Não considerar a entrega concluída sem atender aos critérios aplicáveis e obter aceite explícito do usuário no Marco final; não seguir para commit após validação reprovada.

## Compatibilidade e proteção de dados

- Preservar contratos públicos explicitamente suportados e dados persistidos; documentar migrações, depreciações e remoções.
- Manter compatibilidade somente quando houver requisito definido; não adicionar adaptadores ou fluxos legados preventivamente.
- Mudanças destrutivas em dados ou contratos exigem decisão explícita antes da execução; não apagar bancos do usuário como solução de migração.
- Preservar alterações pendentes do usuário, inclusive arquivos ainda não rastreados. Não descartar nem incluir essas alterações em uma entrega sem verificar o escopo autorizado.

## Versionamento, changelog e commits

- Usar `package.json` como referência da versão do produto e manter coerentes as versões declaradas em `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Respeitar os processos oficiais de atualização de lockfiles e arquivos derivados; não inventar um mecanismo de sincronização inexistente.
- Antes de cada commit de entrega, atualizar a versão: PATCH para correções, refatoração, documentação ou manutenção; MINOR para funcionalidades compatíveis; MAJOR para quebra externa que exija adaptação.
- Migrações internas e remoção de legado não exigem MAJOR por si só; usar o menor incremento aplicável.
- Builds de teste (instaladores para o Marco, em `releases/teste/`) não repetem a versão publicada: usam a próxima versão da entrega com o sufixo `-teste-<plano>`, por exemplo `0.17.0-teste-084`, aplicada só no build com `npm run tauri -- build --config '{"version":"0.17.0-teste-084"}'`, sem alterar os arquivos de versão.
- Manter mudanças notáveis em `CHANGELOG.md`, sob `## [Unreleased]` durante o trabalho.
- Antes do commit de entrega, fechar a release em `## [versão] - YYYY-MM-DD`, com a versão declarada e data local; ordenar da mais recente para a mais antiga.
- Descrever o efeito das mudanças para humanos, sem copiar mensagens de commit nem usar descrições vagas.
- Usar somente categorias aplicáveis: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` e `Security`; não criar categorias vazias.
- Usar Conventional Commits em português: `<tipo>(<escopo opcional>): <descrição>`, omitindo os parênteses quando não houver escopo.
- Tipos usuais: `feat`, `fix`, `docs`, `style`, `refactor`, `test` e `chore`. Usar `!` ou `BREAKING CHANGE:` somente para quebra externa confirmada.
- Antes de pedir autorização para commit, revisar as alterações da entrega e apresentar a mensagem proposta. Registrar mudanças diferentes em linhas próprias, cada uma com o formato completo.
- Após a autorização, preparar versão e release, executar as validações finais e realizar apenas o commit autorizado. Autorização de commit não autoriza push.

## Envio ao GitHub

- Não executar `git push` nem `git pull` por iniciativa própria. O envio acontece somente na publicação de uma release, depois de o usuário aprovar aquela publicação; a aprovação vale uma única vez e não autoriza envios seguintes.
- Não perguntar ao usuário se deseja enviar ao GitHub; ele decide quando enviar.

## Publicação de releases

- Publicar no GitHub com o GitHub CLI (`gh`), a partir da 0.16.0; versões anteriores não têm tag nem release. Push, tag e publicação acontecem somente quando o usuário aprova a publicação daquela versão (ver Envio ao GitHub).
- Publicar somente versões fechadas no `CHANGELOG.md`, a partir do commit de entrega já enviado a `origin/main`.
- Marcar o commit de entrega com tag anotada `vX.Y.Z` (`git tag -a vX.Y.Z -m "CSTM X.Y.Z"`) e enviá-la com `git push origin vX.Y.Z`. Tags publicadas não são movidas, apagadas nem reaproveitadas; um erro numa versão publicada é corrigido numa nova versão.
- Gerar o instalador com `npm run tauri -- build` no commit da tag, com a árvore de trabalho limpa, e copiá-lo para `releases/` (ignorado pelo git) com o nome gerado pelo Tauri, `CSTM_X.Y.Z_x64-setup.exe`.
- Anexar à release o instalador e `SHA256SUMS.txt`, com uma linha `<sha256>  <arquivo>` por ativo (formato do `sha256sum`).
- Título `CSTM X.Y.Z`. Notas: o conteúdo da seção `## [X.Y.Z]` do `CHANGELOG.md`, sem o cabeçalho, seguido de `**Alterações:** https://github.com/marinsgabriel1997/CSTM/compare/vANTERIOR...vX.Y.Z` quando houver tag anterior.
- Quando a publicação pular versões já fechadas e commitadas que não foram publicadas, as notas reúnem as mudanças de todas as versões entre a última publicada e a que está sendo publicada, agrupadas por categoria, com a indicação das versões incluídas; `vANTERIOR` no link de comparação é a última versão publicada. As versões puladas não ganham release; as tags delas permanecem.
- Criar a release como rascunho (`gh release create vX.Y.Z <ativos> --draft --verify-tag --title "CSTM X.Y.Z" --notes-file <notas>`), apresentar o link ao usuário e publicar só após aceite, com `gh release edit vX.Y.Z --draft=false --latest`. Versões com sufixo (`-beta.1`, `-rc.1`) saem com `--prerelease`, sem `--latest`.

## Referências situacionais

| Documento | Quando consultar |
| --- | --- |
| `docs/produto.md` | Antes de alterar escopo, arquitetura, persistência, picker, atalho ou colagem, ler este documento e esclarecer decisões abertas relevantes; atualizá-lo quando uma entrega mudar funcionalidades, módulos ou dependências. |
| `docs/telas.md` | Antes de alterar layout, navegação ou fluxos de uma tela, ler o desenho aprovado e o protótipo correspondente em `docs/prototipo/`; novas telas são desenhadas ali antes de serem implementadas. |
| `docs/ajuda.md` | Antes de criar ou alterar o conteúdo da Ajuda (`src/helpContent.ts`), as imagens dos tutoriais ou as capturas de `scripts/ajuda-imagens.mjs`, seguir o padrão de texto, imagens e marcações descrito ali. |
| `package.json` | Antes de executar scripts ou atualizar a versão do produto, ler scripts e metadados atuais. |
| `src-tauri/Cargo.toml` | Antes de alterar dependências, configuração Rust ou versão do backend, ler este manifesto. |
| `src-tauri/tauri.conf.json` | Antes de alterar janelas, build, identidade, versão ou empacotamento desktop, ler esta configuração. |
| `src-tauri/capabilities/default.json` | Antes de alterar permissões ou expor recursos Tauri às janelas, ler as capabilities aplicáveis. |

- Consultar somente as fontes necessárias à tarefa. Ao criar documentação especializada aprovada, adicionar sua referência e um gatilho explícito de leitura.
