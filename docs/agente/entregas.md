# Entregas

Procedimentos de versionamento, changelog, commits e publicação. As permissões de Git permanecem no [AGENTS.md](../../AGENTS.md#envio-ao-github). Para commits vinculados a issues, consultar [issues.md](issues.md); para alertas de dependências, consultar as exceções em [seguranca-dependencias.md](seguranca-dependencias.md).

## Versionamento

- Mudanças exclusivamente em documentação, instruções de agentes ou processos internos, sem alteração do aplicativo distribuído, seguem a dispensa de versão, release e instalador definida no [AGENTS.md](../../AGENTS.md#histórico-e-permissões-de-entrega).
- Usar `package.json` como referência da versão do produto e manter coerentes as versões declaradas em `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Respeitar os processos oficiais de atualização de lockfiles e arquivos derivados; não inventar um mecanismo de sincronização inexistente.
- Antes de cada commit de entrega que altere o aplicativo distribuído, atualizar a versão: PATCH para correções, refatoração ou manutenção; MINOR para funcionalidades compatíveis; MAJOR para quebra externa que exija adaptação. Exceção: correções de alertas em dependências só de desenvolvimento (ver [Alertas de segurança de dependências](seguranca-dependencias.md)).
- Migrações internas e remoção de legado não exigem MAJOR por si só; usar o menor incremento aplicável.
- Builds de teste (instaladores para o Marco, em `releases/teste/`) não repetem a versão publicada: usam a próxima versão da entrega com o sufixo `-teste-<plano>`, por exemplo `0.17.0-teste-084`, aplicada só no build com `npm run tauri -- build --config '{"version":"0.17.0-teste-084"}'`, sem alterar os arquivos de versão.

## Changelog

- Manter mudanças notáveis em `CHANGELOG.md`, sob `## [Unreleased]` durante o trabalho.
- Antes do commit de entrega com incremento de versão, fechar a release em `## [versão] - YYYY-MM-DD`, com a versão declarada e data local; ordenar da mais recente para a mais antiga.
- Descrever o efeito das mudanças para humanos, sem copiar mensagens de commit nem usar descrições vagas.
- Usar somente categorias aplicáveis: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` e `Security`; não criar categorias vazias.

## Commits

- Usar Conventional Commits em português: `<tipo>(<escopo opcional>): <descrição>`, omitindo os parênteses quando não houver escopo.
- Tipos usuais: `feat`, `fix`, `docs`, `style`, `refactor`, `test` e `chore`. Usar `!` ou `BREAKING CHANGE:` somente para quebra externa confirmada.
- Antes de pedir autorização para commit, revisar as alterações da entrega e apresentar a mensagem proposta. Registrar mudanças diferentes em linhas próprias, cada uma com o formato completo.
- Após a autorização, preparar versão e release quando aplicável, executar as validações finais e realizar apenas o commit autorizado. Autorização de commit não autoriza push.

## Publicação de releases

- Publicar no GitHub com o GitHub CLI (`gh`), a partir da 0.16.0; versões anteriores não têm tag nem release. Push, tag e publicação acontecem somente quando o usuário aprova a publicação daquela versão (ver [Envio ao GitHub](../../AGENTS.md#envio-ao-github)).
- Publicar somente versões fechadas no `CHANGELOG.md`, a partir do commit de entrega já enviado a `origin/main`.
- Marcar o commit de entrega com tag anotada `vX.Y.Z` (`git tag -a vX.Y.Z -m "CSTM X.Y.Z"`) e enviá-la com `git push origin vX.Y.Z`. Tags publicadas não são movidas, apagadas nem reaproveitadas; um erro numa versão publicada é corrigido numa nova versão.
- Gerar o instalador com `npm run tauri -- build` no commit da tag, com a árvore de trabalho limpa, e copiá-lo para `releases/` (ignorado pelo git) com o nome gerado pelo Tauri, `CSTM_X.Y.Z_x64-setup.exe`.
- Anexar à release o instalador e `SHA256SUMS.txt`, com uma linha `<sha256>  <arquivo>` por ativo (formato do `sha256sum`).
- Título `CSTM X.Y.Z`. Notas: o conteúdo da seção `## [X.Y.Z]` do `CHANGELOG.md`, sem o cabeçalho, seguido de `**Alterações:** https://github.com/marinsgabriel1997/CSTM/compare/vANTERIOR...vX.Y.Z` quando houver tag anterior.
- Quando a publicação pular versões já fechadas e commitadas que não foram publicadas, as notas reúnem as mudanças de todas as versões entre a última publicada e a que está sendo publicada, agrupadas por categoria, com a indicação das versões incluídas; `vANTERIOR` no link de comparação é a última versão publicada. As versões puladas não ganham release; as tags delas permanecem.
- Criar a release como rascunho (`gh release create vX.Y.Z <ativos> --draft --verify-tag --title "CSTM X.Y.Z" --notes-file <notas>`), apresentar o link ao usuário e publicar só após aceite, com `gh release edit vX.Y.Z --draft=false --latest`. Versões com sufixo (`-beta.1`, `-rc.1`) saem com `--prerelease`, sem `--latest`.
