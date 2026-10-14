# p65 — Importação e exportação

## Objetivo

Trazer textos de arquivos `.txt`, de pastas do disco e de backups JSON para o CSTM, e levar a biblioteca inteira ou uma pasta para fora, como pastas com arquivos `.txt` ou como backup JSON completo.

## Contexto

Hoje os textos só entram pelo cadastro, um a um, e não há como copiá-los para fora do banco SQLite. O cadastro (p30) tem o botão `+ Novo` com o destino da criação (pasta selecionada, pasta do texto selecionado ou raiz) e o menu de contexto `...` dos itens. O backend expõe as operações de pastas e textos em `db::folders` e `db::snippets`; `serde_json` já é dependência. Não há plugin de diálogo de arquivos no projeto. Importação e exportação não constam em `docs/mvp.md`; este plano as acrescenta ao escopo.

## Decisões

1. **Formato em pastas e `.txt`:** pasta ↔ diretório com o mesmo nome; texto ↔ arquivo `<título>.txt` com o conteúdo. O mesmo formato vale nos dois sentidos.
2. **Formato JSON (backup completo):** objeto `{"format": "cstm", "version": 1, "exported_at", "items"}`, em que `items` é uma árvore aninhada de `{"type": "folder", "name", "items"}` e `{"type": "snippet", "title", "content", "favorite", "use_count", "last_used_at", "created_at", "updated_at"}`. A ordem dos itens no arquivo é a ordem manual. "Exportar tudo" grava os itens da raiz; exportar uma pasta grava a própria pasta como único item.
3. **Interface sem diálogos próprios:** botão `...` ao lado do `+ Novo` com os submenus **Importar** (Arquivos .txt…, Pasta…, Conteúdo de uma pasta…, Backup JSON…) e **Exportar tudo** (Backup JSON…, Pastas e arquivos .txt…); no menu de contexto da pasta, submenu **Exportar** (Backup JSON…, Pastas e arquivos .txt…). O único passo extra é o seletor nativo do Windows.
4. **Destino da importação:** o mesmo do `+ Novo`, mostrado no rodapé do submenu Importar. "Pasta…" cria a própria pasta no destino; "Conteúdo de uma pasta…" coloca as subpastas e os textos dela direto no destino. Arquivos `.txt` avulsos e o backup JSON entram direto no destino.
5. **Importação só cria:** nada é mesclado nem sobrescrito; os itens novos entram no fim do grupo, mesmo com nomes repetidos. Cada importação roda numa única transação: em erro, nada é gravado.
6. **Leitura dos `.txt`:** somente UTF-8, com ou sem BOM (o BOM é removido); quebras de linha convertidas para LF. Título é o nome do arquivo sem `.txt`, ordenado alfabeticamente. Arquivos que não são `.txt`, vazios (após remover espaços das bordas) ou que não são UTF-8 válido são ignorados e listados no resultado. Links simbólicos e junções não são seguidos e, como subpastas ou arquivos que não puderem ser lidos, também aparecem como ignorados. Sem limite de tamanho ou quantidade.
7. **Validação do JSON:** arquivo que não seja do CSTM, de versão desconhecida ou com campos inválidos (título, conteúdo ou nome vazios, tipos errados) não importa nada e informa o motivo.
8. **Exportação nunca sobrescreve:** em pastas e `.txt`, é criada no diretório escolhido uma pasta nova (`CSTM` ou o nome da pasta exportada), com `(2)`, `(3)`… se o nome existir. Nomes de arquivo e diretório são ajustados ao Windows: `<>:"/\|?*` e caracteres de controle trocados por `_`, pontos e espaços finais removidos, nomes reservados (`CON`, `NUL`, `COM1`…) recebem `_` no início, nomes são limitados a 100 caracteres e repetidos na mesma pasta (sem diferenciar maiúsculas) recebem ` (2)`. No JSON, o seletor de salvar sugere `CSTM.json` ou `<pasta>.json`, e a substituição de um arquivo existente é confirmada pelo próprio seletor do Windows.
9. **Codificação na exportação:** UTF-8 sem BOM e quebras de linha LF; JSON indentado.
10. **Pendências:** antes de exportar, as alterações pendentes do editor são gravadas.
11. **Resultado:** em notificação (`Toast` do Fluent UI) no canto inferior direito, que entra e sai deslizando e se empilha com as demais (a mais nova embaixo), por exemplo "12 textos e 3 pastas importados em Trabalho." ou "12 textos e 3 pastas exportados." com o caminho no detalhe, e a lista dos arquivos ignorados (os 10 primeiros e a contagem dos demais). A de sucesso some após 4 segundos, com o tempo pausado sob o mouse; a de erro fica até ser fechada. Cancelar o seletor não faz nada.
12. **Seletores nativos pelo Rust:** `tauri-plugin-dialog` é chamado pelo backend; o frontend não recebe caminhos nem permissões de sistema de arquivos.

## Escopo

- Dependência `tauri-plugin-dialog` 2.
- Módulo `transfer` no backend: leitura de diretórios e `.txt`, nomes de arquivo para o Windows, serialização e validação do JSON, gravação no banco numa transação usando `db`.
- Comandos `import_txt_files(folder_id)`, `import_folder(folder_id, include_root)`, `import_json(folder_id)`, `export_json(folder_id?)` e `export_txt(folder_id?)`; cada um abre o seletor e devolve um resumo ou `null` se cancelado.
- Frontend: botão `...` com os submenus, submenu Exportar no menu da pasta, recarga da árvore após importar, gravação das pendências antes de exportar, notificação de resultado; `api.ts` e `src/test/fakeApi.ts` com os novos comandos.
- Desenho em `docs/telas.md` e no protótipo `docs/prototipo/cadastro.html`, aprovados antes do código.
- Documentação: `docs/mvp.md`, `docs/telas.md`, `README.md`, `CHANGELOG.md`; versão 0.8.0.

Fora do escopo: arrastar arquivos ou pastas do Explorer; outras codificações além de UTF-8; mesclar ou substituir itens existentes; contagem prévia antes de importar; exportar textos avulsos ou favoritos.

## Estado desejado

1. Importar arquivos `.txt` cria um texto por arquivo no destino, com o nome do arquivo como título.
2. "Importar → Pasta…" cria a pasta escolhida no destino com subpastas e textos; "Conteúdo de uma pasta…" coloca o conteúdo direto no destino.
3. Arquivos que não são `.txt`, vazios ou fora de UTF-8 são ignorados e aparecem na notificação.
4. "Exportar tudo → Pastas e arquivos .txt…" cria uma pasta nova no diretório escolhido, sem sobrescrever nada, com a estrutura da biblioteca; títulos com caracteres inválidos ou repetidos geram nomes válidos e distintos.
5. Exportar em JSON e importar o arquivo recria pastas, textos, ordem, favoritos, contador de uso e datas.
6. Um JSON inválido ou de outro programa não importa nada e mostra o motivo.
7. Exportar com alterações pendentes no editor inclui o conteúdo mais recente.
8. Cancelar qualquer seletor não altera nada.

## Premissas

- Os seletores do `tauri-plugin-dialog` funcionam a partir de comandos assíncronos no Windows sem bloquear a janela.
- Arquivos `.txt` criados por programas atuais (Bloco de Notas do Windows 11, VS Code) usam UTF-8.

## Riscos

- Sem limites, importar um diretório enorme por engano (por exemplo, a pasta do usuário) pode demorar e criar muitos itens; o resultado só é conhecido ao final. Mitigação: a importação é uma única transação e os itens podem ser excluídos pela pasta criada.
- `.txt` antigos em ANSI ou UTF-16 são ignorados; a notificação lista os arquivos para o usuário convertê-los.
- Exportar para `.txt` perde favoritos, ordem, contador e datas; reimportar ordena alfabeticamente. Informado pela existência do backup JSON.
- Títulos que diferem apenas por maiúsculas/minúsculas colidem no Windows; tratados como repetidos.

## Estratégia de validação

- `cargo test`: nomes de arquivo (inválidos, reservados, repetidos, maiúsculas), leitura UTF-8 com e sem BOM, rejeição de não UTF-8 e vazios, conversão de quebras de linha, ida e volta em pastas e `.txt` e em JSON num diretório temporário, rejeição de JSON inválido sem gravar nada, "Pasta" × "Conteúdo de uma pasta".
- `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`.
- `npm run test` (menus, comandos chamados com o destino certo, notificações, gravação das pendências antes de exportar), `npm run build`, `npm run lint`.
- Validação manual no Windows dos itens do estado desejado, com seletores nativos, um `.txt` do Bloco de Notas e a reimportação de uma exportação.

## Fases

### Fase 1 — Desenho

- [x] Registrar o botão `...`, os submenus, o submenu Exportar da pasta e as notificações em `docs/telas.md`.
- [x] Atualizar o protótipo `docs/prototipo/cadastro.html` com os menus e as notificações.

Critério: desenho aprovado pelo usuário.

### Fase 2 — Backend

- [x] Adicionar `tauri-plugin-dialog` e criar o módulo `transfer` com testes.
- [x] Expor os cinco comandos.

Critério: `cargo build`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Frontend

- [x] Adicionar os comandos em `api.ts` e `fakeApi.ts`.
- [x] Implementar os menus, a recarga da árvore, a gravação das pendências antes de exportar e a notificação de resultado, com testes.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Validação no Windows

- [x] Validar manualmente os itens do estado desejado.

Critério: validação aprovada pelo usuário.

Validação aprovada. Ajustes pedidos na validação, com desenho aprovado: o resultado passou de aviso no topo da janela para notificações empilháveis no canto inferior direito, que somem após 4 segundos quando de sucesso.

### Fase 5 — Documentação

- [x] Atualizar `docs/mvp.md`, `docs/telas.md`, `README.md` e `CHANGELOG.md`.

Critério: documentação coerente com o comportamento implementado.
