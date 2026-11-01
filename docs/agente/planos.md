# Planos

Procedimento de criação, execução, acompanhamento e conclusão dos planos. Os modos e limites de autonomia permanecem no [AGENTS.md](../../AGENTS.md#modos-e-fluxo-de-trabalho).

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
