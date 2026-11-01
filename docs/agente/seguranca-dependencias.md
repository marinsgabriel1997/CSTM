# Alertas de segurança de dependências

Procedimento específico para alertas npm e Cargo. Respeitar os limites do [AGENTS.md](../../AGENTS.md#envio-ao-github). Quando aplicável, consultar [planos.md](planos.md), [validacao.md](validacao.md) e [entregas.md](entregas.md).

- Ler os alertas abertos com o `gh` (`gh api repos/marinsgabriel1997/CSTM/dependabot/alerts`) e, para cada um, identificar o pacote, a versão corrigida, se a dependência é direta ou transitiva e se entra no aplicativo instalado (crates do `src-tauri/` e pacotes empacotados pelo Vite) ou é só de desenvolvimento (testes, lint, build). Alertas abertos ao mesmo tempo são corrigidos juntos, num só commit.
- PRs de segurança abertos pelo Dependabot servem só de referência: a correção é feita localmente por este fluxo, e o bot fecha o PR quando o lockfile corrigido chega a `origin/main`.
- Aplicar a menor correção: atualizar o pacote dentro das faixas já declaradas, alterando só o lockfile (`npm update <pacote>` ou `cargo update -p <crate>`). Se a correção exigir mudar faixa, subir versão MAJOR de dependência ou alterar código, seguir o fluxo normal com plano.
- Sem versão corrigida, ou com ela fora da faixa aceita por outro pacote, levar o caso ao usuário com as opções de esperar a correção ou dispensar o alerta no GitHub com justificativa; dispensar é decisão do usuário.
- Executar as validações aplicáveis aos pacotes afetados (`npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`) e conferir com `npm ls <pacote>` ou `cargo tree -i <crate>` que só a versão corrigida permanece.
- Dependência só de desenvolvimento: sem plano; registrar em `## [Unreleased]`, categoria `Security`, sem subir a versão nem fechar release; a mudança sai na próxima versão do aplicativo.
- Dependência do aplicativo instalado: registrar um plano curto, com o instalador de teste (ver [Versionamento](entregas.md#versionamento)) e o Marco para validação do usuário no Windows; após o aceite, subir PATCH e fechar a release no `CHANGELOG.md`.
- Commit somente com autorização. Como o alerta só fecha com a correção em `origin/main`, o push do commit autorizado pode ser feito com autorização explícita para aquele push, sem tag nem release quando a dependência é só de desenvolvimento.
- Para dependência do aplicativo instalado, a correção conta como pedido de publicação: após o commit, seguir [Publicação de releases](entregas.md#publicação-de-releases) até o rascunho e pedir o aceite do usuário para publicar.
- Depois do push, confirmar com o `gh` que os alertas fecharam; se algum continuar aberto depois que o GitHub atualizar o grafo de dependências, procurar outros caminhos na árvore que ainda usem a versão vulnerável.
