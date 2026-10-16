# 081 — Títulos completos no picker

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-15
- Concluído em: 2026-10-15

## Objetivo

Permitir ler o título completo de um texto no menu de colagem (picker), hoje cortado por reticências.

## Contexto

- A coluna principal tem 340 px (`WIDTH` em `src-tauri/src/picker.rs`) e as subcolunas 300 px (`SUB_WIDTH` em `src-tauri/src/cascade.rs`). A janela do picker é fixa e recortada para a cascata não piscar (plano 075).
- O rótulo da linha usa uma linha só, com `textOverflow: "ellipsis"` (`src/Picker.tsx`, estilo `label`).
- A dica nativa (`title`) da linha mostra só o conteúdo do texto (ou caminho + conteúdo nos resultados da busca); o título nunca aparece inteiro.
- A altura das subcolunas é calculada pelo conteúdo ao abrir (`contentHeight`, plano 079), supondo linhas de altura fixa.

## Decisões do usuário

- Combinar três soluções: colunas mais largas, título em até 2 linhas e dica com o título completo.

## Escopo

### Incluído

- **Colunas mais largas**: coluna principal de 340 → 420 px e subcolunas de 300 → 380 px (lógicos). Com três colunas abertas (1180 px), ainda cabem em 1080p a 125% (1536 lógicos); a regra atual de virar para a esquerda continua valendo.
- **Título em até 2 linhas**: textos, itens do Histórico e pastas quebram o título em até 2 linhas (`line-clamp`) antes das reticências. Linhas com 1 linha mantêm a altura atual.
- **Dica com título**: a dica nativa de textos passa a ser `título`, linha em branco, conteúdo (nos resultados da busca: título, caminho, conteúdo). Mantém a dica nativa do Windows, que não é recortada pela janela do picker, em vez de um `Tooltip` do Fluent.
- **Altura das colunas** recalculada considerando linhas de 2 linhas (medição real ou estimativa pelo texto), sem sobra nem corte no fim da lista; a rolagem até a linha selecionada continua funcionando.
- Atualizar desenho (`docs/telas.md`, `docs/prototipo/picker.html`), testes Rust de geometria e testes Vitest.

### Fora do escopo

- Painel de pré-visualização ao lado da coluna.
- Largura configurável pelo usuário.

## Estado desejado

Títulos de até ~2 linhas aparecem inteiros no picker; títulos maiores podem ser lidos na dica.

## Riscos e premissas

- Linhas de altura variável podem quebrar o cálculo de `contentHeight` e o posicionamento da cascata; é o ponto de maior risco e exige validação visual.
- Colunas mais largas reduzem o espaço para a cascata em telas pequenas; a regra de inverter lado já cobre, mas pode encobrir mais a janela de destino.
- A dica nativa só aparece com o mouse, não na seleção por teclado; as 2 linhas cobrem a maior parte dos casos.

## Estratégia de validação

- `npm run test`, `npm run build`, `npm run lint`.
- `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`.
- Validação manual no Windows (Marco).

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md` (Tela 2) e `docs/prototipo/picker.html`: novas larguras, título em 2 linhas e dica.

Critério: os documentos descrevem o comportamento deste plano.

### Fase 2 — Larguras (backend)

- [x] `WIDTH` e `SUB_WIDTH` (e constantes de teste) com os novos valores; testes de `cascade.rs` e `picker.rs` ajustados aos novos tamanhos.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Linhas, altura e dica (frontend)

- [x] Rótulo com até 2 linhas e altura de linha variável.
- [x] Cálculo de altura das colunas compatível com linhas de 2 linhas.
- [x] Dica com título + conteúdo.
- [x] Testes Vitest da dica e do cálculo de altura.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Ajuda, documentação e instalador de teste

- [x] `src/helpContent.ts`, se citar a dica ou o corte de títulos; `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

### Fase 5 — Correção: altura das linhas de texto

- [x] A estimativa contava 32 px para toda linha de 1 linha, mas as linhas de texto e do Histórico medem 36 px (o botão Copiar, ou o espaço reservado a ele, tem 24 px de altura, mais 2 × 6 px de preenchimento); `estimateRowHeight` passa a usar a altura do Copiar nos itens.
- [x] Testes Vitest de altura corrigidos (eles fixavam 32 px para textos) e um teste novo com três textos de título curto.
- [x] Gerar novo instalador de teste em `releases/teste/`.

Critério: `npm run test`, `npm run build` e `npm run lint` passam e o instalador existe.

## Marco — Validação do usuário

- [x] Um título longo aparece em 2 linhas, com reticências só depois da 2ª.
- [x] Passar o mouse sobre o texto mostra o título completo e o conteúdo.
- [x] As novas larguras ficam boas em 1080p e 4K.
- [x] Uma coluna com vários títulos de 2 linhas não sobra nem corta no fim; `↑`/`↓` rolam até a linha selecionada.
- [x] Abrir e fechar colunas continua sem piscar, inclusive com a cascata invertida perto da borda direita.

Validação técnica: `npm run test` (199), `npm run build`, `npm run lint`, `npm run test:rust` (151), `npm run lint:rust` e `cargo fmt --check` passaram. Instalador de teste (o mesmo para os planos 080, 081 e 082): `releases/teste/CSTM_0.15.0-teste-080-081-082-20261015-1817_x64-setup.exe`. A altura das subcolunas é estimada pelo comprimento do título (7 px por caractere), pois a coluna só existe depois do layout; conferir sobras ou cortes.

Resultado (2026-10-15): reprovado em um ponto. Uma subcoluna com três textos de título curto (pasta Google Chat) mostrou barra de rolagem mesmo com espaço para crescer. Demais verificações aprovadas. Correção na Fase 5; reconferir o item de altura das colunas.

Validação técnica da Fase 5: `npm run test` (200), `npm run build` e `npm run lint` passaram. Instalador de teste: `releases/teste/CSTM_0.15.0-teste-081-fase5-20261015-2317_x64-setup.exe`.

Resultado (2026-10-15, após a Fase 5): validado pelo usuário no Windows. Aceito.
