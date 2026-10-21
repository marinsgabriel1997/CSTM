# 093 — Correção das vulnerabilidades de TLS da verificação de atualização

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-21
- Concluído em: 2026-10-21

## Objetivo

Eliminar as duas vulnerabilidades conhecidas que o `cargo audit` aponta nas dependências Rust, para que a versão submetida à homologação na empresa não tenha vulnerabilidades conhecidas.

## Contexto

- `cargo audit` (cargo-audit 0.22.2, base RustSec de 2026-10-21) aponta:
  - `rustls-webpki` 0.103.15 — RUSTSEC-2026-0382: a verificação de certificados pode aceitar intermediários desconfiados. Corrigida em 0.103.16.
  - `webpki-roots` 1.0.9 — RUSTSEC-2026-0381: as raízes embutidas confiam em intermediários emSign desconfiados. Corrigida em 1.0.10.
- As duas entram só por `ureq` (TLS rustls), usado unicamente na verificação de atualização (`update.rs`, consulta a `api.github.com`). O impacto é baixo: exigiria interceptação com certificado da autoridade revogada, e o pior efeito seria um aviso falso de versão nova, já que o CSTM nunca baixa nem instala nada.
- Os 5 avisos restantes (`glib`, `zbus_names`, `zvariant`, `zvariant_derive`, `proc-macro-error`) não entram no build Windows (`cargo tree --target x86_64-pc-windows-msvc -i <crate>` não encontra nenhum); ficam fora do escopo.
- `npm audit` não aponta vulnerabilidades.

## Decisões

- Atualizar só as duas crates no `Cargo.lock` (`cargo update -p rustls-webpki -p webpki-roots`), sem mudar o `Cargo.toml` nem outras dependências.
- A entrega é uma correção: versão PATCH 1.0.1 no commit de entrega; o instalador de teste usa `1.0.1-teste-093`.
- Sem mudança visível ao usuário: Ajuda e imagens não mudam.

## Escopo

- `src-tauri/Cargo.lock`: `rustls-webpki` 0.103.16 e `webpki-roots` 1.0.10.
- `CHANGELOG.md`: entrada em `[Unreleased]`, categoria `Security`.

## Riscos e premissas

- Atualizações de patch semver-compatíveis; risco baixo de regressão. A verificação de atualização (HTTPS ao GitHub) precisa continuar funcionando, o que é validado no Marco.

## Validação

- `cargo audit` sem vulnerabilidades.
- `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passando.
- Instalador de teste gerado em `releases/teste/`.

## Fase 1 — Atualizar as dependências

- [x] Atualizar `rustls-webpki` e `webpki-roots` no `Cargo.lock`; o diff do lockfile só altera essas duas crates.
- [x] `cargo audit` sem vulnerabilidades; `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passando.

Critério: as cinco verificações acima passam e o diff se limita a `Cargo.lock`.

## Fase 2 — Changelog e instalador de teste

- [x] Entrada `Security` em `[Unreleased]` no `CHANGELOG.md`.
- [x] Instalador `1.0.1-teste-093` gerado e copiado para `releases/teste/`.

Critério: o instalador existe em `releases/teste/`.

## Marco — Validação do usuário

- [x] Instalar o `releases/teste/CSTM_1.0.1-teste-093_x64-setup.exe` sobre a 1.0.0; os textos e as configurações continuam lá.
- [x] Em Configurações › Atualizações, **Verificar agora** conclui sem erro e informa que não há versão nova (a 1.0.0 publicada é mais antiga que a 1.0.1 de teste); qualquer mensagem de falha de conexão reprova.
- [x] Uso normal: abrir o menu com Alt+Q e colar um texto e um item do histórico.

Resultado: aprovado pelo usuário em 2026-10-21; as três verificações passaram.

Aceite: aceito pelo usuário em 2026-10-21.
