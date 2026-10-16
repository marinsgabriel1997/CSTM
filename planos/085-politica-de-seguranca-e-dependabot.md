# 085 — Política de segurança e atualizações do Dependabot

- Status: Em validação
- Prioridade: Baixa
- Criado em: 2026-10-16

## Objetivo

Completar a análise de segurança do repositório no GitHub com uma política de segurança (`SECURITY.md`), exibida em Security → Policy, e com atualizações periódicas de versão das dependências npm e cargo pelo Dependabot (`.github/dependabot.yml`).

## Contexto

- Em 2026-10-16 o usuário ativou no GitHub, pela interface: Private vulnerability reporting, Dependency graph, Dependabot alerts, Malware alerts, Dependabot security updates (agrupados), CodeQL em *Default setup* (JavaScript/TypeScript e Rust), Copilot Autofix, Secret Protection e Push protection. Essas configurações ficam no GitHub, não no repositório.
- A primeira análise do CodeQL terminou sem alertas, e o secret scanning não encontrou nada. O Dependabot abriu um alerta de severidade média (#1) no `glib` 0.18.5. Esse crate só entra no build Linux, pela pilha GTK do Tauri (`glib → gtk → libappindicator → tray-icon`; `cargo tree` para `x86_64-pc-windows-msvc` não o inclui). A correção exige o `glib` 0.20, incompatível com o `gtk` 0.18 usado pelo Tauri; a orientação foi dispensar o alerta como "Vulnerable code is not actually used".
- O repositório não tem `.github/` nem `SECURITY.md`. As atualizações de segurança do Dependabot funcionam sem arquivo; as atualizações de versão exigem `.github/dependabot.yml`.
- Os manifestos ficam em `/` (`package.json` e `package-lock.json`) e em `/src-tauri` (`Cargo.toml` e `Cargo.lock`).

## Decisões do usuário

- Atualizações de versão **mensais**, para npm e cargo.
- Agrupamento: um PR por ecossistema com as atualizações **minor e patch**; cada atualização **major** em PR próprio.
- O README **não** muda nesta entrega (o GitHub já exibe o `SECURITY.md` na aba Security; o README tem alterações pendentes do usuário, que ficam fora desta entrega).

## Escopo

### Incluído

- **`SECURITY.md`** na raiz, em português:
  - Versões com suporte: só a release mais recente; correções saem numa nova versão.
  - Como reportar: pelo reporte privado do GitHub (`https://github.com/marinsgabriel1997/CSTM/security/advisories/new`), sem abrir issue pública. Informar a versão, o Windows usado, os passos para reproduzir e o impacto.
  - O que esperar: o projeto é mantido por uma pessoa, sem prazo garantido de resposta. O reporte recebe confirmação, a correção sai numa nova versão e a pessoa que reportou recebe crédito no aviso, se quiser.
  - Contexto útil: o CSTM roda localmente no Windows, sem conta e sem serviços na nuvem. Os dados ficam em `%APPDATA%\com.gabriel.cstm\cstm.db`, e o histórico do clipboard pode guardar o que foi copiado.
- **`.github/dependabot.yml`** (versão 2):
  - Ecossistema `npm` em `/` e `cargo` em `/src-tauri`, com `schedule.interval: monthly`.
  - Em cada ecossistema, um grupo com `update-types: [minor, patch]`; as majors ficam fora do grupo e saem em PRs próprios.
  - `commit-message.prefix: chore(deps)`, para seguir os Conventional Commits do projeto.
- **`CHANGELOG.md`**: entrada em `## [Unreleased]`, categoria `Added`, descrevendo a política de segurança e o reporte privado de vulnerabilidades.

### Fora do escopo

- Workflow próprio do CodeQL (*advanced setup*): o *Default setup* já cobre TypeScript e Rust.
- Atualizações do ecossistema `github-actions`: o repositório não tem workflows próprios.
- Mudanças no código, na Ajuda (`src/helpContent.ts`) e em `docs/produto.md`: nada visível no aplicativo muda.
- README.
- Correção do alerta do `glib`: depende do Tauri.

## Estado desejado

Após o envio ao GitHub, que ocorre na próxima publicação de release aprovada, Security → Policy mostra a política, e Insights → Dependency graph → Dependabot lista os dois ecossistemas com verificação mensal, sem erro de configuração.

## Riscos e premissas

- Os PRs de versão do Dependabot podem quebrar o build, principalmente em majors do Tauri ou do Fluent UI. Por isso cada major vem isolada. Cada PR é revisado e validado pelo usuário antes do merge; nada é aplicado sozinho.
- A configuração do Dependabot só é validada de verdade pelo GitHub, depois do envio. Como o envio só acontece na publicação de uma release, um erro no YAML aparece só então e é corrigido numa nova versão.
- Premissa: os PRs de segurança já ativados continuam valendo, sem conflito com o agrupamento de versão. O agrupamento de segurança está configurado na interface; o grupo do YAML vale para as atualizações de versão.

## Estratégia de validação

- Verificar a sintaxe do `dependabot.yml` com um parser YAML local disponível e conferir chaves e valores contra a documentação do Dependabot.
- Conferir que os diretórios do `dependabot.yml` contêm os manifestos esperados.
- Revisar o `SECURITY.md` quanto a links, texto em pt-BR e conteúdo prometido.
- Como só há documentação e configuração, `npm run test`, `npm run build` e os testes Rust não se aplicam; o diff não toca código.

## Fases

### Fase 1 — Arquivos

- [x] Criar `SECURITY.md` com o conteúdo do escopo.
- [x] Criar `.github/dependabot.yml` com o conteúdo do escopo.
- [x] Registrar a entrada em `CHANGELOG.md`, sob `## [Unreleased]`.

Critério: os três arquivos existem com o conteúdo do escopo, o YAML é válido no parser local e o diff não toca outros arquivos (o `README.md` pendente do usuário fica intacto).

## Marco — Validação do usuário

Verificações possíveis antes do envio:

- [x] Ler o `SECURITY.md` e aprovar o texto.
- [x] Revisar o `.github/dependabot.yml`.

Verificações depois do envio ao GitHub, na próxima release:

- [ ] Security → Policy mostra a política.
- [ ] Insights → Dependency graph → Dependabot lista npm e cargo, sem erro de configuração.

Validação técnica (2026-10-16): o `dependabot.yml` foi lido sem erros pelo pacote `yaml` 2, instalado numa pasta temporária fora do projeto, e corresponde ao escopo (npm em `/` e cargo em `/src-tauri`, mensal, grupo minor+patch, prefixo `chore(deps)`). Os manifestos existem nos dois diretórios. O diff contém só `SECURITY.md`, `.github/dependabot.yml`, `CHANGELOG.md` e este plano; o `README.md` pendente do usuário não foi alterado.

Resultados do usuário (2026-10-16): `SECURITY.md` e `dependabot.yml` aprovados. Verificações no GitHub pendentes até o envio.

Aceite: parcial (verificações antes do envio aprovadas em 2026-10-16).
