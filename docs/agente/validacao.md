# Testes e validação

Procedimento de verificação técnica e funcional. Os requisitos mínimos e limites permanecem no [AGENTS.md](../../AGENTS.md#testes-e-validação); os comandos oficiais estão na seção [Ambiente e comandos](../../AGENTS.md#ambiente-e-comandos).

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
