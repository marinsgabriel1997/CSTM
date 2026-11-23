# 097 — Data e hora no nome dos arquivos exportados

- Status: Concluído
- Concluído em: 2026-11-23
- Prioridade: Média
- Criado em: 2026-11-22
- Issue: #8

## Objetivo

Os backups e as exportações passam a levar a data e a hora locais no nome, para que exportações feitas em momentos diferentes se distingam e não se sobrescrevam.

## Contexto

Hoje `transfer::json_file_name` sugere `CSTM.json` (biblioteca inteira ou vários itens) ou `<pasta>.json` (uma pasta sozinha), e `transfer::export_txt` cria a pasta `CSTM` ou `<pasta>`, com ` (2)`, ` (3)`… quando o nome já existe (`create_new_dir`). A importação de pasta (`import_folder`, opção "com ela") cria no CSTM uma pasta com o nome da pasta do disco.

## Decisões com o usuário

- Formato do issue: nome, espaço e `AAAA-MM-DD HH-MM-SS`, na data e hora locais do Windows. Exemplos: `CSTM 2026-10-31 14-35-08.json`, `Trabalho 2026-10-31 14-35-08.json` e a pasta `CSTM 2026-10-31 14-35-08`.
- Backup JSON: a hora é a do momento em que o diálogo de salvar abre (nome sugerido). Exportação em .txt: a hora é a do momento em que a pasta é criada.
- O sufixo ` (2)` continua quando a pasta já existe.
- Ao importar uma pasta com "Importar pasta (com ela)", a data no fim do nome é retirada: a pasta `CSTM 2026-10-31 14-35-08` vira `CSTM` no CSTM. Detalhe definido pelo orquestrador: retira-se só um sufixo exato ` AAAA-MM-DD HH-MM-SS`, opcionalmente seguido de ` (n)`, e só da pasta importada (não das subpastas); se sobrar nome vazio, o nome original fica. A opção "só o conteúdo" e o backup JSON não mudam.

## Escopo

- `src-tauri/src/transfer.rs`: carimbo de data e hora no nome sugerido do JSON e na pasta da exportação .txt; retirada do carimbo na importação de pasta; testes Rust com a hora injetada (função pura que recebe a data e hora).
- Hora local pelo Windows (`GetLocalTime`, recurso `Win32_System_SystemInformation` do crate `windows`, já usado); sem dependência nova.
- `src/helpContent.ts` (uma frase na seção Importar e exportar), `docs/telas.md`, `docs/produto.md` se citar os nomes, `CHANGELOG.md`.
- `e2e/windows/importar-exportar.spec.ts`: expectativas dos nomes.
- Versão 1.1.3 (PATCH: ajuste de comportamento existente); instalador de teste `1.1.3-teste-097` em `releases/teste/`.

## Riscos e premissas

- Testes não podem depender do relógio: o carimbo é gerado por uma função que recebe a data e hora.
- Nomes de pasta muito longos já são cortados (`MAX_NAME_CHARS`); o carimbo entra depois do corte do nome, para não ser cortado.

## Fase 1 — Backend

- [x] Carimbo local e nomes do JSON e da pasta .txt com a data e hora.
- [x] Importação de pasta sem o carimbo no nome.
- [x] Testes Rust para nomes com carimbo, ` (2)` e retirada do carimbo.
- Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam. ✔ 203 testes Rust, clippy e fmt limpos.

## Fase 2 — Ajuda, documentação e testes de interface

- [x] Ajuda (e protótipo `docs/prototipo/ajuda.html`), `docs/telas.md`, `CHANGELOG.md` (Unreleased) e specs do `e2e/`.
- [x] `npm run lint`, `npm run build`, `npm run test` e `npm run e2e:build` seguido de `npm run test:app` passam. ✔ Vitest 298; `test:app` 82 passando e 4 adiados. A imagem da Ajuda de Importar e exportar mostra só o menu, então não precisa ser regenerada.
- [ ] `npm run test:windows` (só o arquivo de importar e exportar), após aviso e autorização do usuário. Pulado por decisão do usuário (2026-11-23): a conferência fica no Marco, com o instalador; a spec foi ajustada (tsc e lint limpos), mas não rodou.
- Critério: validações passando.

## Fase 3 — Versão e instalador de teste

- [x] Instalador `1.1.3-teste-097` em `releases/teste/` (`CSTM_1.1.3-teste-097_x64-setup.exe`, 4,03 MiB).
- Critério: instalador gerado.

## Marco — Validação do usuário

- [x] Exportar tudo em Backup JSON: o nome sugerido é `CSTM <data e hora>.json`.
- [x] Exportar uma pasta em Backup JSON: `<pasta> <data e hora>.json`.
- [x] Exportar em .txt duas vezes: duas pastas com horários diferentes.
- [x] Importar uma pasta exportada com "Importar pasta (com ela)": a pasta no CSTM fica sem a data.

Resultados: o usuário validou as verificações com o instalador de teste em 2026-11-23.

Aceite: "aprovados" (usuário, 2026-11-23).
