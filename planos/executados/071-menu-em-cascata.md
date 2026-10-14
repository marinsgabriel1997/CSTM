# 071 — Menu em cascata

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Permitir navegar nas pastas do menu de colagem sem clicar: ao parar o mouse sobre uma pasta, o conteúdo dela abre numa coluna ao lado, como os submenus do Windows. A cascata passa a ser o modo padrão; o modo atual (clicar para entrar na pasta) continua disponível nas Configurações.

## Contexto

- O picker (`src/Picker.tsx`) é uma janela única de 340 × 440 px (`WIDTH`/`HEIGHT` em `src-tauri/src/picker.rs`), posicionada junto ao cursor por `place()` dentro da área útil do monitor; clicar numa pasta substitui a lista pelo conteúdo dela.
- Na raiz ficam as pastas virtuais Mais usados e Favoritos (p67), seguidas das pastas e textos.
- As configurações ficam na tabela de configurações do banco (`db/settings.rs`), usada pelo atalho do menu (p55).
- A janela do picker tem `shadow: true`, sem transparência.

## Decisões

1. **Uma janela só:** a janela do picker cresce para conter as colunas abertas; foco e colagem continuam como hoje. A janela fica transparente e cada coluna é um cartão próprio, com sombra e cantos desenhados em CSS; a sombra nativa da janela é desligada. Clicar na área transparente fecha o menu, como clicar fora.
2. **Modo padrão:** cascata, inclusive para quem já usa o app. Opção "Navegação nas pastas" nas Configurações: **Abrir ao passar o mouse** (padrão) ou **Clicar para abrir**, gravada no banco.
3. **Abertura:** a pasta abre assim que o mouse passa sobre ela, sem atraso; clicar também abre. Passar para outra pasta substitui as colunas abertas a partir dali; voltar a um texto fecha as colunas mais profundas. Vale para as pastas reais e para Mais usados e Favoritos.
4. **Teclado:** ↑/↓ na coluna atual; → ou Enter numa pasta abre a coluna e entra nela; ← volta uma coluna; Esc fecha o menu, como hoje.
5. **Coluna principal:** mantém o tamanho atual, com a busca no topo. A busca continua mostrando os resultados numa lista única, sem cascata.
6. **Posição horizontal:** a coluna nova abre à direita da anterior; sem espaço, abre à esquerda; sem espaço dos dois lados, as colunas mais antigas saem de vista.
7. **Posição vertical da subcoluna:**
   1. Topo alinhado à pasta que a abriu e altura pelo conteúdo.
   2. Se passar da borda inferior da área útil, sobe o necessário para caber, podendo ficar acima da pasta e do topo do menu principal.
   3. Se for maior que a área útil, ocupa toda a altura dela, com rolagem; ↑/↓ rolam até o item selecionado.
8. **Janela:** tem o tamanho do retângulo que envolve as colunas abertas, sempre dentro da área útil do monitor. O backend calcula o retângulo; a coluna principal não se move na tela. Ao reabrir (Alt+Q), o menu volta a uma coluna.
9. **Detalhes aprovados no desenho:** sem espaço dos dois lados, a coluna nova encosta na borda direita da área útil e cobre as mais antigas, que saem de vista; à esquerda só abre se não cobrir colunas abertas. O topo do cartão fica na altura da linha da pasta. Subcolunas de 300 px de largura, 2 px entre cartões, linhas de 32 px.
10. **Versão:** 0.10.0 (funcionalidade compatível).

## Escopo

- Desenho em `docs/telas.md` e nos protótipos `docs/prototipo/picker.html` e da tela de configurações.
- Backend: configuração da navegação; comando que recebe as colunas abertas (tamanhos e âncoras) e devolve/aplica posição e tamanho da janela, com a geometria testada.
- `tauri.conf.json`: janela do picker transparente, sem sombra nativa.
- Frontend: picker em colunas, os dois modos, teclado e rolagem; opção nas Configurações; `api.ts` e `fakeApi.ts`.
- Documentação: `docs/mvp.md`, `README.md`, `CHANGELOG.md`; versão 0.10.0.

Fora do escopo: cascata nos resultados da busca, janelas separadas por coluna, mudar o atalho, a posição inicial ou o fluxo de colagem.

## Estado desejado

1. No modo cascata, passar o mouse sobre uma pasta abre a coluna ao lado, alinhada à pasta e com a altura do conteúdo.
2. Perto da borda direita a coluna abre à esquerda; perto da borda inferior ela sobe; colunas maiores que a tela rolam.
3. O teclado navega entre as colunas com →, ← e Enter.
4. No modo clique, o menu se comporta como hoje.
5. A troca do modo nas Configurações vale na próxima abertura do menu e persiste.
6. A colagem continua funcionando nos dois modos.

## Premissas

- O Tauri 2 suporta janela transparente sem decoração no WebView2 do Windows.
- Redimensionar e reposicionar a janela antes de desenhar a coluna nova evita cintilação perceptível.

## Riscos

- Transparência no WebView2: a sombra nativa sai e a área transparente ainda captura cliques; mitigado com sombra em CSS e fechamento ao clicar nela. Validação no Windows obrigatória.
- Cintilação ou atraso ao redimensionar; mitigado aplicando o tamanho antes de mostrar a coluna.
- Movimento diagonal do mouse até a coluna nova passando por outra pasta; sem atraso, atravessar outra pasta na diagonal troca a coluna aberta (aceito pelo usuário); mitigação: mover o mouse na horizontal até a coluna.
- Monitores com escalas diferentes; a geometria trabalha em pixels físicos a partir da escala do monitor, como em `place()`.

## Estratégia de validação

- Automatizada: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`.
- Testes do backend da geometria: caso normal, bate embaixo, maior que a área útil, sem espaço à direita, sem espaço dos dois lados e borda direita e inferior ao mesmo tempo.
- Testes do frontend: abertura ao passar o mouse e por clique, troca e fechamento de colunas, teclado, modo clique, opção nas Configurações.
- Funcional no Windows, com o usuário (Marco).

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md`: menu em cascata e opção nas Configurações.
- [x] Protótipos do picker em cascata (casos normal, borda direita, borda inferior e coluna com rolagem) e da opção nas Configurações.
- [x] Desenho aprovado pelo usuário.

Critério: desenho aprovado explicitamente pelo usuário (decisão de desenho prevista no plano, anterior às fases técnicas).

### Fase 2 — Backend

- [x] Configuração da navegação com padrão cascata; comandos de leitura e gravação. Chave `picker_navigation` (`cascade`/`click`) na tabela de configurações; `get_picker_navigation` e `set_picker_navigation` (a gravação recusa outros valores).
- [x] Geometria das colunas e da janela, com testes; comando que aplica posição e tamanho. Geometria pura em `src-tauri/src/cascade.rs` (porta do protótipo, em pixels lógicos a partir de pixels físicos e escala); comando `layout_picker` usa a coluna principal guardada por `show()` (`PickerGeometry`) e devolve a posição das colunas relativa à janela.
- [x] Janela do picker transparente e sem sombra nativa; reabertura volta a uma coluna. `transparent: true` e `shadow: false` em `tauri.conf.json`; `show()` reaplica 340 × 440 e o frontend descarta as colunas no aviso `picker-opened`.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Picker em cascata

- [x] Colunas, abertura ao passar o mouse, clique, teclado, rolagem e fechamento ao clicar na área transparente. O layout é pedido ao backend e a coluna só é desenhada depois da resposta; o movimento do mouse só conta se a posição muda (o navegador repete o movimento quando a lista rola); colunas cobertas ficam com opacidade 0 para a busca manter o foco.
- [x] Modo clique preservado; `api.ts` e `fakeApi.ts` (`getPickerNavigation`, `setPickerNavigation`, `layoutPicker`).
- [x] Testes. Os testes existentes do picker passaram a fixar o modo clique no `beforeEach`; os da cascata abrem as colunas ao passar o mouse.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Configurações

- [x] Opção "Navegação nas pastas" na tela de configurações, com teste. `RadioGroup` no `SettingsDialog`, abaixo do atalho; lê o valor ao abrir e grava ao selecionar.

Critério: `npm run test` passa.

### Fase 5 — Documentação e validação técnica

- [x] Documentação e CHANGELOG atualizados; versão 0.10.0.
- [x] Validações automatizadas executadas.

Critério: todas as validações automatizadas passam.

### Fase 6 — Abertura sem atraso

- [x] Cascata abre a pasta assim que o mouse passa sobre ela (atraso de 300 ms removido), com testes e documentação atualizados.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

## Marco — Validação do usuário

Verificações no aplicativo desktop (`npm run tauri -- dev`):

- [x] Cascata com o mouse: abre ao passar o mouse, alinhada à pasta, com altura pelo conteúdo; trocar de pasta e voltar a um texto fecham as colunas certas.
- [x] Cascata com o teclado: →, ←, Enter e Esc.
- [x] Perto da borda direita abre à esquerda; perto da borda inferior a coluna sobe; pasta com muitos textos rola.
- [x] Cartões com sombra e cantos corretos, sem cintilação; clicar na área transparente fecha o menu.
- [x] Em monitor com escala diferente, o menu continua correto.
- [x] Modo "Clicar para abrir" nas Configurações volta ao comportamento anterior e persiste.
- [x] A colagem funciona nos dois modos.

Resultado (2026-10-14): todas as verificações aprovadas pelo usuário; ajuste pedido: abrir as pastas sem atraso (Fase 6).

- [x] Após a Fase 6: a pasta abre imediatamente ao passar o mouse.

Resultado (2026-10-14): abertura sem atraso validada; entrega aceita pelo usuário.
