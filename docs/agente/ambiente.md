# Ambiente de desenvolvimento

Cuidados de execução do CSTM. Os comandos oficiais permanecem na seção Ambiente e comandos do [AGENTS.md](../../AGENTS.md#ambiente-e-comandos); consultar também os manifestos indicados nas referências situacionais da raiz.

- Usar os scripts existentes em `package.json`, preservando `package-lock.json` e `src-tauri/Cargo.lock` conforme as dependências efetivamente alteradas.
- A configuração Vite usa a porta fixa 1420. Verificar os requisitos locais de Node, Rust e ferramentas Windows antes de executar o fluxo desktop.
- Os testes de interface usam o Playwright (`@playwright/test`) só para conectar ao WebView2 pela porta 9333 (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`); não é preciso instalar navegadores do Playwright. A porta precisa estar livre.
- `npm run test:windows` usa um helper em PowerShell 5.1 com C# (`e2e/support/windows/`) para teclado, mouse, clipboard, UI Automation e diálogos; requer sessão interativa do Windows desbloqueada e com o PC livre durante a execução.
