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

## Testes de interface

Os testes de interface ficam em `e2e/` e usam o build de teste (`npm run e2e:build`), com identificador `com.gabriel.cstm.teste`: banco, configurações e instância única separados dos do usuário. A limpeza só apaga pastas com esse nome exato; os dados em `%APPDATA%\com.gabriel.cstm` nunca são tocados. As atualizações são desligadas logo ao abrir, para nenhum teste consultar o GitHub. Cada teste abre uma instância nova do app.

- `npm run test:app` (`e2e/app/`): o aplicativo real pelo Playwright, conectado à porta de depuração do WebView2. Cobre cadastro, árvore, Lixeira, persistência, Configurações, Ajuda, Sobre e o menu de colagem acionado por comandos, sem teclado, mouse nem clipboard reais. O agente roda quando a entrega afeta a interface, junto com `npm run test` e `npm run build`.
- `npm run test:windows` (`e2e/windows/`): atalho global, colagem e modos, Depois de colar, Histórico, troca de atalho, janela oculta e instância única, bandeja e importar e exportar, com teclado, mouse e clipboard reais, colando numa janela própria do teste. Leva cerca de 3 minutos.
  - O agente roda somente depois de avisar o usuário e receber autorização para aquela execução; a autorização vale uma única vez. Ao terminar uma implementação que precise dessa validação, o agente avisa e pergunta.
  - A sessão salva o clipboard do usuário, fecha o CSTM instalado (se estiver aberto) e, no fim, devolve o clipboard e reabre o CSTM. O registro fica em `e2e/.resultados/windows/sessao.log`; `CSTM_E2E_ENSAIO=1` confere o helper sem fechar, salvar nem restaurar nada.
  - Se a execução travar, encerrar só o build de teste (`src-tauri/target/debug/cstm.exe`); a sessão restaura o clipboard e reabre o CSTM no encerramento.
  - Diálogos de arquivo só recebem nome simples depois de conferida a pasta temporária do teste; sem essa conferência, o diálogo é cancelado.
- Relatórios, prints e logs ficam em `e2e/.resultados/` (fora do git).
- Continuam manuais: aparência e layout, UIPI (programa como administrador), vários monitores e escalas, Iniciar com o Windows, atualizações (notificação e barra), formatação colada no Word, Outlook, Gmail e Teams, e instalador e desinstalador.
