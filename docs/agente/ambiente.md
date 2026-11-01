# Ambiente de desenvolvimento

Cuidados de execução do CSTM. Os comandos oficiais permanecem na seção Ambiente e comandos do [AGENTS.md](../../AGENTS.md#ambiente-e-comandos); consultar também os manifestos indicados nas referências situacionais da raiz.

- Usar os scripts existentes em `package.json`, preservando `package-lock.json` e `src-tauri/Cargo.lock` conforme as dependências efetivamente alteradas.
- A configuração Vite usa a porta fixa 1420. Verificar os requisitos locais de Node, Rust e ferramentas Windows antes de executar o fluxo desktop.
