# p20 — Banco de dados

## Objetivo

Implementar a camada de persistência SQLite do backend — conexão, migrações e operações de pastas e textos — com testes automatizados, e abrir o banco na inicialização do aplicativo.

## Contexto

O backend contém apenas o `run()` do Tauri, sem dependências de banco. `docs/mvp.md` define o modelo de dados (`folders`, `snippets`, `snippets_fts`), a localização do banco (`%APPDATA%\com.gabriel.cstm\cstm.db`) e as dependências `rusqlite` (feature `bundled`) e `rusqlite_migration`. Não há infraestrutura de testes. Corresponde à etapa 2 de `docs/mvp.md`.

## Escopo

- Dependências `rusqlite` 0.40 (feature `bundled`) e `rusqlite_migration` 2.6.
- Módulo `db` em `src-tauri/src/db/`: `mod.rs` (conexão, migrações, erros, ordenação compartilhada), `folders.rs`, `snippets.rs`.
- Migração inicial com o esquema do MVP, índices e gatilhos de sincronização do FTS5.
- Abertura do banco na pasta de dados do aplicativo e registro como estado do Tauri (`Mutex<Connection>`).
- Script `npm run test:rust` (`cargo test`).

Fora do escopo: comandos Tauri (p30, junto da tela de cadastro) e qualquer alteração de frontend.

## Contratos

### Operações

| Área | Operações |
| --- | --- |
| Pastas | criar, renomear, excluir, mover (pai e/ou posição), obter, listar todas |
| Textos | criar, atualizar título e conteúdo, excluir, marcar favorito, mover (pasta e/ou posição), obter, listar por pasta, listar favoritos, buscar, registrar uso |

### Regras

1. Datas em texto ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.SSSZ`), geradas pelo SQLite. `updated_at` muda em edições do usuário (renomear, editar, favoritar, mover), não ao registrar uso.
2. Ordenação manual: item novo entra no fim da pasta; mover para a posição N renumera os irmãos do destino em sequência a partir de 0. Posição além do fim equivale ao fim.
3. Excluir pasta remove em cascata subpastas e textos.
4. Mover pasta para si mesma ou para uma descendente é rejeitado.
5. Nome de pasta, título e conteúdo não podem ser vazios após remover espaços das bordas. Nome e título são gravados sem os espaços das bordas; o conteúdo é gravado sem alteração.
6. Busca por FTS5 sobre título e conteúdo: cada termo da entrada corresponde por prefixo, todos os termos são exigidos, acentos e maiúsculas são ignorados, título tem peso maior. Caracteres especiais da sintaxe FTS5 na entrada não causam erro. Entrada sem termos retorna lista vazia.
7. Favoritos ordenados por título, sem diferenciar maiúsculas (ASCII).
8. Erros representados pelo enum `DbError`, sem dependência adicional.
9. Falha ao abrir ou migrar o banco encerra o aplicativo com mensagem; o banco nunca é apagado ou recriado automaticamente.

## Estado desejado

- O aplicativo cria ou abre `cstm.db` na pasta de dados e aplica as migrações pendentes.
- Todas as operações acima existem no módulo `db` e são cobertas por testes.

## Premissas

- O SQLite compilado pelo feature `bundled` inclui FTS5.
- Exclusões em cascata por chave estrangeira disparam os gatilhos de exclusão de `snippets`.
- Uma única conexão protegida por `Mutex` é suficiente para o MVP.

## Riscos

- A migração inicial torna-se contrato após o primeiro uso real; mudanças futuras de esquema exigem novas migrações.
- As operações do módulo `db` ficam sem uso fora dos testes até o p30; o aviso de código não utilizado é suprimido com `#[expect(dead_code)]` até lá.

## Estratégia de validação

- `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`, `cargo build`.
- Validação manual no Windows: `npm run tauri -- dev` cria `%APPDATA%\com.gabriel.cstm\cstm.db`.

## Fases

### Fase 1 — Dependências e conexão

- [x] Adicionar `rusqlite` e `rusqlite_migration`.
- [x] Criar `db/mod.rs` com abertura da conexão, `foreign_keys` ativo e migração inicial.
- [x] Adicionar o script `test:rust`.
- [x] Testes: migrações válidas, `foreign_keys` ativo, FTS5 disponível, reabertura preserva dados.

Critério: `npm run test:rust` passa.

### Fase 2 — Pastas

- [x] Implementar as operações de pastas.
- [x] Testes: criação e ordem, validação de nome, renomear, mover com reordenação, rejeição de ciclo, exclusão em cascata, pasta inexistente.

Critério: `npm run test:rust` e `npm run lint:rust` passam.

### Fase 3 — Textos

- [x] Implementar as operações de textos.
- [x] Testes: CRUD, validação, ordem e movimentação, favoritos, busca (prefixo, acentos, múltiplos termos, caracteres especiais, entrada vazia), sincronização do FTS em edição, exclusão e cascata, registro de uso.

Critério: `npm run test:rust` e `npm run lint:rust` passam.

### Fase 4 — Integração e documentação

- [x] Abrir o banco na inicialização e registrar o estado no Tauri.
- [x] Atualizar `AGENTS.md`, `README.md` e `CHANGELOG.md`.

Critério: `cargo build`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam; validação manual do arquivo do banco no Windows.
