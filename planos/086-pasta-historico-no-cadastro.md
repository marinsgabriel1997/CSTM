# 086 — Pasta Histórico no cadastro

- Status: Planejado
- Prioridade: Média
- Criado em: 2026-10-19

## Objetivo

Gerenciar o histórico do clipboard no cadastro: uma pasta Histórico fixa no topo da árvore, onde os itens são editados e excluídos (para a Lixeira). No menu de colagem, o histórico ganha só a lixeira.

## Contexto

- O histórico (plano 077) só aparece no picker, na pasta virtual Histórico; a linha selecionada tem os modos de colagem (plano 083) e o Copiar. A única remoção é "Limpar histórico", nas Configurações, que apaga tudo.
- A tabela `clipboard_items` guarda texto, HTML, RTF e imagem, limitada a 100 itens por `position`; copiar de novo um conteúdo já guardado sobe o item em vez de repeti-lo.
- A Lixeira do cadastro (`db::items`) trata pastas e textos por `deleted_at`, com Restaurar, Excluir definitivamente, Esvaziar lixeira e Desfazer na notificação.
- Os itens do picker trazem só o `preview` encurtado; o texto completo vem do backend.

## Escopo

1. **Pasta Histórico** fixa no topo da árvore, acima das pastas: abre e fecha como uma pasta, mostra os itens do mais recente para o mais antigo, com a hora. Some com o histórico desligado ou vazio, e com a busca ou o filtro de favoritos ativos. Não aceita arrastar, soltar, renomear, Novo, colar, ordenar nem seleção múltipla.
2. **Editar:** um item de texto selecionado abre um editor só de conteúdo (o título é a primeira linha). Grava após uma pausa na digitação; ao gravar, a formatação HTML/RTF é descartada e o item sobe para o topo. Texto vazio não é gravado e o editor avisa. Imagens mostram a imagem e as dimensões, sem edição.
3. **Excluir:** botão Excluir no editor e `Del` na árvore movem o item para a Lixeira, com Desfazer na notificação; `Shift+Del` exclui definitivamente, com confirmação.
4. **Lixeira:** itens do histórico aparecem com "Estava em: Histórico". Restaurar devolve o item ao histórico na posição que ele tinha; Excluir definitivamente e Esvaziar lixeira os apagam.
5. **Regras do histórico:** itens na lixeira não contam no limite de 100 nem são reaproveitados ao copiar o mesmo conteúdo (entra um item novo). "Limpar histórico" apaga também os que estão na lixeira.
6. **Picker:** a linha selecionada do histórico ganha a lixeira ao lado do Copiar; `Delete` faz o mesmo quando o cursor está no fim da busca e não há trecho selecionado. A seleção passa ao item vizinho; com o histórico vazio, a coluna fecha.

Fora do escopo: salvar item do histórico como texto cadastrado, editar a formatação, editar imagens, histórico na busca do cadastro.

## Estado desejado (técnico)

- Migração acrescenta `deleted_at TEXT` a `clipboard_items`; `list`, limite e deduplicação ignoram itens com `deleted_at`.
- `db::clipboard` ganha `update_text` (texto novo, `html`/`rtf` nulos, sobe ao topo) e as operações de lixeira; `clear` apaga tudo.
- `ItemRef` e `TrashItem` aceitam o tipo `"clip"`; `trash_items`, `restore_items`, `delete_items` e `empty_trash` tratam esses itens e emitem `clipboard-history-changed`.
- Comandos novos: `get_clipboard_item(id)` (texto completo) e `update_clipboard_item(id, text)`.
- Frontend: `api.ts`, `fakeApi.ts`, árvore (`tree.ts`, `LibraryTree.tsx`, `TreePane.tsx`), editor (`Editors.tsx`), lixeira e Desfazer (`App.tsx`, `Panels.tsx`) e picker (`Picker.tsx`).

## Riscos

- Ampliação de `ItemRef` e da lixeira afeta Desfazer, seleção múltipla, cópia, movimentação e exportação, que devem ignorar ou recusar `"clip"`; os testes atuais da árvore e da lixeira servem de rede.
- No backend, `db::items::Kind` mapeia cada tipo para tabela, coluna de pai e ordem manual (`ordered()`), usados por `copy`, `arrange`, `restore` e `transfer::export_of`. O tipo `"clip"` não tem pai nem ordem manual: essas funções devem recusá-lo com erro explícito, e `trash`/`restore`/`delete`/`empty_trash`/`list_trash` precisam de um ramo próprio para `clipboard_items` (restaurar só limpa `deleted_at`, mantendo `position`).
- Migração em banco com dados: coluna nova nula por padrão, sem perda; coberta por teste.
- Edição concorrente com cópias novas: o item sobe a cada gravação e a lista é recarregada pelo evento; a seleção segue o item pelo `id`.
- Conflito de `Delete` com a busca no picker: mitigado pela regra do cursor.

## Premissas

- Restaurar devolve a `position` original; se outro item tiver ocupado o lugar, a ordem relativa por `position` continua válida.
- O histórico desligado não oculta itens já na lixeira.

## Estratégia de validação

- Rust: `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`.
- Frontend: `npm run test`, `npm run build`, `npm run lint`.
- Funcional no Windows: Marco.

## Fase 0 — Desenho

- [ ] `docs/telas.md`: pasta Histórico na árvore, editor do item (texto e imagem), lixeira com itens do histórico, lixeira na linha do picker.
- [ ] `docs/prototipo/cadastro.html` e `docs/prototipo/picker.html` atualizados.

Critério: desenho registrado e coerente com o escopo.

## Fase 1 — Backend

- [ ] Migração de `deleted_at` em `clipboard_items`, com teste em banco existente.
- [ ] `list`, limite e deduplicação ignoram itens na lixeira; `clear` apaga tudo.
- [ ] `update_text`, `get_text` e operações de lixeira para itens do histórico, com testes.
- [ ] `ItemRef`/`TrashItem` com `"clip"` em `trash_items`, `restore_items`, `delete_items`, `empty_trash` e `list_trash`.
- [ ] Comandos `get_clipboard_item` e `update_clipboard_item` registrados.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passando.

## Fase 2 — API e fakeApi

- [ ] Tipos e comandos novos em `src/api.ts`; `src/test/fakeApi.ts` coerente (lixeira, restauração e edição do histórico).

Critério: `npm run build` passando.

## Fase 3 — Cadastro

- [ ] Pasta Histórico no topo da árvore, com as restrições do escopo.
- [ ] Editor do item de texto (gravação automática, aviso de vazio) e de imagem.
- [ ] Excluir, `Del`, `Shift+Del`, Lixeira com "Histórico" e Desfazer.
- [ ] Testes em `App.test.tsx` e/ou `TreeOperations.test.tsx`.

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

## Fase 4 — Picker

- [ ] Lixeira na linha selecionada do histórico e tecla `Delete` com a regra do cursor.
- [ ] Testes em `Picker.test.tsx`: botão, tecla, `Delete` no meio da busca não exclui, exclusão do último item.

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

## Fase 5 — Documentação

- [ ] `docs/produto.md`, `src/helpContent.ts` e `CHANGELOG.md` (`Added`).

Critério: documentação revisada e coerente com o código.

## Marco — Validação do usuário

- [ ] A pasta Histórico aparece no topo da árvore e some com o histórico desligado ou vazio.
- [ ] Editar um texto grava sem a formatação, o item sobe ao topo e a mudança aparece no picker.
- [ ] Imagens aparecem no editor, sem edição.
- [ ] Excluir/`Del` move para a Lixeira; Desfazer e Restaurar devolvem ao histórico.
- [ ] `Shift+Del` e Esvaziar lixeira apagam de vez.
- [ ] Lixeira e `Delete` do picker funcionam; `Delete` no meio da busca apaga caracteres.
- [ ] "Limpar histórico" apaga também os itens do histórico na Lixeira.
- [ ] A Ajuda descreve a pasta, a edição e a exclusão.

Resultados: —

Aceite: —
