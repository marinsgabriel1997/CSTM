# Instruções do projeto CSTM

## Contexto e escopo

- CSTM é um aplicativo desktop para cadastrar, organizar e colar textos reutilizáveis por meio de um menu flutuante e atalho global.
- O produto tem como alvo o Windows; o MVP foi concluído e `docs/produto.md` descreve as funcionalidades atuais. Expansão por abreviação, transformações de texto, variáveis e suporte a Linux/macOS estão fora do escopo documentado. O histórico do clipboard (plano 077) guarda textos, formatação HTML/RTF e imagens; o cadastro continua só com textos.
- A stack atual é React 19, TypeScript 6, Vite 8, Fluent UI React v9, Tauri 2 e Rust edição 2024. A interface usa componentes, tokens e `makeStyles` do Fluent UI.
- `src/` contém o frontend; `src-tauri/` contém o backend e a configuração desktop; `docs/produto.md` descreve as funcionalidades, o escopo e a arquitetura.
- Não tratar como implementado o que só estiver em planos ou no roadmap do README.

## Ambiente e comandos

- `npm run dev`: iniciar somente o frontend Vite.
- `npm run build`: verificar TypeScript e gerar o build do frontend com Vite.
- `npm run preview`: visualizar o build do frontend.
- `npm run tauri -- dev`: iniciar o aplicativo desktop em desenvolvimento; a configuração Tauri chama `npm run dev`.
- `npm run tauri -- build`: construir o aplicativo desktop; a configuração Tauri chama `npm run build`.
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
- Após implementar e validar tecnicamente a entrega, atualizar a documentação afetada e registrar mudanças notáveis. Quando a entrega alterar o aplicativo distribuído, gerar o instalador de teste em `releases/teste/` (ver [Versionamento](docs/agente/entregas.md#versionamento)) e apresentar o Marco final com o caminho do instalador, para validação exclusiva do usuário, incluindo verificações no Windows quando necessárias. O plano só é concluído após aceite explícito do Marco.
- Não realizar commit sem autorização explícita específica para a operação. Push e pull seguem a seção Envio ao GitHub.

## Delegação a subagentes

- O agente principal atua como orquestrador: define e edita contratos, planos e documentação, divide o trabalho em tarefas, revisa os resultados e executa as validações finais.
- A implementação é delegada a subagentes, escolhidos conforme a complexidade: Haiku para tarefas mecânicas e bem delimitadas (ajustes pontuais, renomeações, testes simples, verificações); Sonnet para tarefas que exigem raciocínio sobre o código (componentes, integração, diagnóstico de falhas).
- Cada tarefa delegada tem escopo fechado: objetivo, arquivos que podem ser alterados, contratos e convenções a seguir, o que não deve ser tocado e critério de conclusão verificável. Subagentes não decidem escopo, arquitetura ou contratos, não editam planos nem documentação e não fazem commit.
- O orquestrador revisa o diff de cada tarefa antes de seguir; alterações fora do escopo pedido são descartadas e a tarefa é refeita.

## Planos

- Manter planos ativos em `planos/` e concluídos em `planos/executados/`. Nomear novos planos no formato `NNN-nome-descritivo.md`, por exemplo `001-autenticacao.md`, com ID numérico sequencial, permanente e não reutilizável; o ID não representa prioridade.
- Após registrar o plano, executar as fases continuamente, sem pausas de aceite intermediárias; não avançar à fase seguinte antes de atender ao critério técnico da fase atual.
- Manter uma única seção `Marco — Validação do usuário`, persistente e sempre a última seção do arquivo, abaixo de todas as fases. Conter checklist das verificações funcionais/manuais do usuário, resultados e aceite explícito; somente o usuário pode validar e aprovar essas verificações.
- Somente após aceite explícito de todas as verificações aplicáveis no Marco, concluir o plano e movê-lo para `planos/executados/`, preservando seu ID e nome.

## Issues

- Pendências, bugs e ideias ficam em issues do GitHub (`marinsgabriel1997/CSTM`), lidas com `gh issue list` e `gh issue view`; não manter listas de pendências em arquivos do repositório. Uma issue registra o pedido; ela não é um plano nem uma decisão aprovada.
- Criar, editar, comentar ou fechar issues somente a pedido do usuário. Pendências percebidas durante o trabalho, fora do escopo da tarefa, são sugeridas ao usuário com título e resumo propostos, sem abrir a issue por conta própria.
- Registrar a issue encerra a tarefa: plano e implementação só começam com pedido explícito do usuário.

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
- Para alterações de frontend, executar `npm run test` e `npm run build` (tipos e build); isso não substitui validação funcional no aplicativo desktop.
- Validar alterações de backend e integração desktop com verificações adequadas ao Rust/Tauri, relatando os comandos efetivamente executados e seus resultados.
- Atalho global, foco, clipboard, entrada simulada, bandeja e instância única exigem validação funcional no Windows quando afetados.
- Distinguir verificações automatizadas de testes manuais e registrar o que não pôde ser validado.
- Não considerar a entrega concluída sem atender aos critérios aplicáveis e obter aceite explícito do usuário no Marco final; não seguir para commit após validação reprovada.

## Compatibilidade e proteção de dados

- Preservar contratos públicos explicitamente suportados e dados persistidos; documentar migrações, depreciações e remoções.
- Manter compatibilidade somente quando houver requisito definido; não adicionar adaptadores ou fluxos legados preventivamente.
- Mudanças destrutivas em dados ou contratos exigem decisão explícita antes da execução; não apagar bancos do usuário como solução de migração.
- Preservar alterações pendentes do usuário, inclusive arquivos ainda não rastreados. Não descartar nem incluir essas alterações em uma entrega sem verificar o escopo autorizado.

## Histórico e permissões de entrega

- Mudanças exclusivamente em documentação, instruções de agentes ou processos internos, sem alteração do aplicativo distribuído, dispensam incremento de versão, fechamento ou publicação de release e geração de instalador.
- Manter mudanças notáveis em `CHANGELOG.md`, sob `## [Unreleased]` durante o trabalho.
- Antes de pedir autorização para commit, revisar as alterações da entrega e apresentar a mensagem proposta. Autorização de commit não autoriza push.
- Push, tag e publicação exigem autorização para aquela publicação; preservar as exceções do procedimento de alertas de segurança de dependências.
- Tags publicadas não são movidas, apagadas nem reaproveitadas; um erro numa versão publicada é corrigido numa nova versão.
- Criar releases como rascunho e publicar somente após aceite do usuário. Dispensar alerta de segurança é decisão do usuário.

## Envio ao GitHub

- Não executar `git push` nem `git pull` por iniciativa própria. O envio acontece somente na publicação de uma release, depois de o usuário aprovar aquela publicação; a aprovação vale uma única vez e não autoriza envios seguintes. Exceção: o push da correção de um alerta de segurança (ver [Alertas de segurança de dependências](docs/agente/seguranca-dependencias.md)).
- Não perguntar ao usuário se deseja enviar ao GitHub; ele decide quando enviar.

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
| `docs/agente/ambiente.md` | Antes de executar scripts, iniciar frontend/desktop ou usar ferramentas de build, lint e formatação, ler os cuidados de ambiente; os comandos oficiais estão neste `AGENTS.md`. |
| `docs/agente/planos.md` | Antes de criar, atualizar, executar ou concluir um plano, ler o procedimento de IDs, fases e Marco. |
| `docs/agente/issues.md` | Antes de consultar, registrar ou alterar demandas, vincular plano ou preparar commit que resolva issue, ler o procedimento de issues. |
| `docs/agente/validacao.md` | Antes de definir a estratégia de validação, escrever testes ou validar uma entrega, ler os procedimentos técnicos e funcionais. |
| `docs/agente/entregas.md` | Antes de preparar instalador, atualizar versão ou changelog, redigir mensagem ou realizar commit, criar/enviar tag ou operar publicação de release, ler o procedimento de entregas. |
| `docs/agente/seguranca-dependencias.md` | Antes de analisar, corrigir ou dispensar alertas de dependências, ler o procedimento e suas exceções de plano, versão, commit, push e publicação. |

- Consultar somente as fontes necessárias à tarefa. Ao criar documentação especializada aprovada, adicionar sua referência e um gatilho explícito de leitura.
