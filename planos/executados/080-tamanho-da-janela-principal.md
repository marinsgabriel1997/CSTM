# 080 — Tamanho da janela principal

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-15
- Concluído em: 2026-10-15

## Objetivo

Abrir a janela principal (`main`) num tamanho confortável para a tela do usuário e, depois, lembrar o tamanho, a posição e o estado maximizado que ele deixou.

## Contexto

- Hoje a janela `main` tem tamanho fixo de 1000×650 lógicos (mínimo 760×480) em `src-tauri/tauri.conf.json`, sem guardar tamanho nem posição.
- Proporção atual da tela ocupada:

  | Monitor | Escala | Área lógica | 1000×650 ocupa |
  | --- | --- | --- | --- |
  | 1080p | 100% | 1920×1080 | ~52% × 60% |
  | 1080p | 125% | 1536×864 | ~65% × 75% |
  | 4K | 150% | 2560×1440 | ~39% × 45% |
  | 4K | 200% | 1920×1080 | ~52% × 60% |

- As janelas têm `create: false` e são criadas em `setup` (`src-tauri/src/lib.rs`) a partir da configuração; iniciada pelo Windows, a `main` nasce oculta.
- As preferências ficam na tabela `settings` do SQLite (`src-tauri/src/db/settings.rs`).

## Decisões do usuário

- Na primeira abertura, tamanho proporcional à área útil do monitor; depois, lembrar tamanho, posição e maximizado.

## Escopo

### Incluído

- **Primeira abertura** (sem estado salvo): largura = 75% e altura = 80% da área útil (sem a barra de tarefas) do monitor principal, em pixels lógicos, limitadas entre 1000×650 e 1600×1000, e centralizada nessa área.
  - Exemplos: 1080p a 100% (área útil ~1920×1032) → 1440×826; 1080p a 125% (~1536×824) → 1152×659; 4K a 150% (~2560×1408) → 1600×1000 (teto).
- **Estado lembrado**: posição, tamanho (lógicos) e maximizado gravados em `settings` (chave `main_window`, JSON) quando a janela é ocultada/fechada e ao sair do app; restaurados na criação da janela.
- **Proteção**: se o estado salvo ficar fora de todos os monitores atuais (monitor desconectado, resolução trocada), cair na regra da primeira abertura. O mínimo 760×480 continua valendo.
- Lógica de cálculo (proporção, limites, validação contra monitores) em funções puras com testes Rust.

### Fora do escopo

- Tamanho do picker (tratado no plano 081).
- Plugin `tauri-plugin-window-state`: a tabela `settings` já existe e evita dependência nova.
- Configuração manual de tamanho na tela de Configurações.

## Estado desejado

A janela abre grande o bastante em 1080p e 4K e reaparece onde e como o usuário a deixou.

## Riscos e premissas

- Monitores com escalas diferentes: guardar posição em pixels físicos e tamanho em lógicos pode deslocar a janela entre monitores; validar no Windows com dois monitores se disponível.
- Restaurar maximizado deve guardar também o tamanho "normal" para quando o usuário desmaximizar.
- Gravar só em eventos de ocultar/fechar/sair evita escrita contínua no banco ao arrastar.

## Estratégia de validação

- `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`.
- `npm run test` e `npm run build` se o frontend for tocado.
- Validação manual no Windows (Marco).

## Fases

### Fase 1 — Cálculo e persistência (backend)

- [x] Funções puras: tamanho inicial pela área útil e validação do estado salvo contra os monitores; testes para os exemplos do escopo, limites e estado fora da tela.
- [x] Leitura/gravação de `main_window` em `settings`, com testes.

Critério: `npm run test:rust` passa com os testes novos; `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 2 — Aplicação na janela

- [x] Em `setup`, aplicar o estado salvo ou o tamanho inicial ao criar a `main` (sem piscar em outro tamanho antes).
- [x] Gravar o estado ao ocultar/fechar a `main` e ao sair pelo menu da bandeja.

Critério: validações automatizadas passam e o app inicia com `npm run tauri -- dev`.

### Fase 3 — Documentação e instalador de teste

- [x] Atualizar `docs/telas.md` se descrever o tamanho da janela; `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

## Marco — Validação do usuário

- [x] Sem estado salvo (banco novo ou chave removida), a janela abre centralizada e proporcional no monitor 1080p.
- [x] O mesmo no 4K (ou com a escala alterada), respeitando o teto de 1600×1000.
- [x] Redimensionar, mover, fechar para a bandeja e reabrir mantém tamanho e posição.
- [x] Maximizar, sair do app e iniciar de novo reabre maximizada; desmaximizar volta ao tamanho anterior.
- [x] Com o estado salvo fora da tela (ex.: monitor desconectado), a janela volta a abrir visível.
- [x] Iniciado pelo Windows, o app continua só na bandeja.

Validação técnica: `npm run test` (199), `npm run build`, `npm run lint`, `npm run test:rust` (151), `npm run lint:rust` e `cargo fmt --check` passaram. Instalador de teste (o mesmo para os planos 080, 081 e 082): `releases/teste/CSTM_0.15.0-teste-080-081-082-20261015-1817_x64-setup.exe`. O executável de release iniciou e abriu a janela centralizada no teto de 1600×1000 numa área útil de 3072×1680 (verificação rápida, sem estado salvo).

Resultado (2026-10-15): validado pelo usuário no Windows. Aceito.
