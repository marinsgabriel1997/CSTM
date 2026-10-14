# 075 — Cascata sem piscar

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Acabar com o pisca-pisca do menu de colagem ao navegar entre pastas na cascata. Para isso, a janela `picker` deixa de ser redimensionada e movida a cada coluna que abre ou fecha. O clique fora dos cartões continua chegando ao programa que está atrás do menu.

## Contexto

- Hoje a janela `picker` tem o tamanho do retângulo que envolve as colunas abertas. A cada coluna aberta ou fechada, `picker::layout` (`src-tauri/src/picker.rs`) chama `set_size` e `set_position`, duas chamadas separadas ao Windows. O frontend (`src/Picker.tsx`) só depois aplica as novas posições das colunas, que são relativas ao canto da janela.
- Disso vêm três efeitos visíveis:
  - um quadro intermediário, com o tamanho novo na posição antiga;
  - um quadro com as colunas deslocadas, quando a origem da janela muda (abrir à esquerda, subir perto da borda ou subcoluna acima do topo da anterior);
  - a área nova vazia que o WebView2 transparente mostra ao crescer.
- Na cascata, a coluna abre sem atraso ao passar o mouse (`docs/telas.md`, Tela 2, Navegação nas pastas, item 3). Por isso o efeito se repete a cada linha de pasta percorrida.
- A geometria das colunas (`src-tauri/src/cascade.rs`, `arrange`) é pura e testada. A regra de posição das colunas não muda neste plano; muda só o referencial (janela fixa) e o que é devolvido.
- A abertura do menu (`picker::show`) posiciona a janela em 340 × 440 junto ao cursor e emite `picker-opened`. O frontend volta à raiz ao receber o evento. A janela aparece em seguida, e por um quadro pode mostrar o conteúdo da abertura anterior.
- Duas alternativas foram descartadas pelo usuário:
  - janela fixa sem região, porque o clique fora dos cartões deixaria de chegar ao programa de trás;
  - só suavizar o redimensionamento, porque não elimina o efeito.

## Escopo

1. **Janela fixa por abertura.** Ao abrir o menu, a janela `picker` passa a ocupar a área útil do monitor do cursor e não muda de tamanho nem de posição até fechar. Isso vale nos dois modos de navegação (cascata e clique).
2. **Região da janela.** Com `SetWindowRgn` (feature `Win32_Graphics_Gdi` do crate `windows`), a janela fica limitada à união dos retângulos das colunas visíveis.
   - Cada retângulo ganha uma margem lógica fixa para a sombra do cartão (`shadow16`).
   - Fora da região, o Windows não desenha a janela, e o clique vai para o programa de trás. Esse clique tira o foco do menu, que fecha, como hoje.
   - A região é atualizada pelo backend a cada `layout_picker`.
3. **Geometria.**
   - `cascade::arrange` passa a devolver as colunas relativas à área útil (a janela), sem calcular o retângulo envolvente, e os retângulos físicos da região.
   - A coluna principal continua parada na tela.
   - As regras de posição (direita, esquerda, borda direita, colunas escondidas, altura) não mudam.
4. **Abertura sem quadro velho.**
   - `picker-opened` passa a levar a posição da coluna principal.
   - A janela é mostrada e focada já com a região vazia (invisível). O frontend aplica o estado inicial e, depois do próximo quadro desenhado, chama um novo comando `picker_ready`, que aplica a região da coluna principal.
   - Se o aviso não chegar em 150 ms, o backend aplica a região mesmo assim, para o menu nunca deixar de aparecer.
5. **Frontend.**
   - A coluna principal usa sempre a posição recebida do backend, inclusive no modo clique, em vez de `inset: 0`.
   - O clique na área transparente dentro da região (margem da sombra e intervalos entre cartões) continua fechando o menu.
6. **Documentação.** `docs/telas.md` (Tela 2: janela e item 8 da cascata) e `docs/mvp.md` (janela `picker` e módulo `cascade`) passam a descrever a janela fixa com região.
7. **Fora do escopo:**
   - atraso na abertura das pastas ao passar o mouse (continua imediata, como hoje);
   - mudanças na regra de posição das colunas, no visual dos cartões, na colagem ou no atalho;
   - outros sistemas operacionais.

## Estado desejado

- Navegar entre pastas na cascata, com o mouse ou o teclado, abre e fecha colunas sem a janela piscar, tremer ou mostrar áreas vazias, inclusive perto das bordas direita e inferior.
- As colunas abrem nas mesmas posições de hoje, e a coluna principal não se move.
- Clicar fora dos cartões fecha o menu, e o clique chega ao programa de trás, como hoje.
- Ao abrir, o menu aparece junto ao cursor já na raiz, sem mostrar por um instante o conteúdo da abertura anterior.
- O modo "Clicar para abrir" funciona como hoje.

## Riscos

- **WebView2 transparente.** A região (`SetWindowRgn`) precisa funcionar bem com a janela transparente do Tauri/WebView2: recorte do desenho, clique passando para o programa de trás e nenhum artefato ao mudar a região. É o risco principal, por isso a Fase 1 é uma prova técnica. Se ela falhar, o plano para, e eu levo as evidências para uma decisão.
- **Desempenho.** Uma janela transparente do tamanho da área útil pode custar mais memória de GPU e tempo de composição do que a janela pequena de hoje. A Fase 1 também observa isso.
- **Corte da sombra.** Se a margem for pequena demais, a sombra aparece cortada nas bordas da região; se for grande demais, cliques muito próximos do cartão ficam no menu e o fecham sem chegar ao programa de trás. A margem é ajustada na validação visual.
- **Escala e monitores.** Mudanças de escala (DPI) e monitores com coordenadas negativas precisam continuar corretos. Os testes de `cascade` e `place` existentes cobrem a geometria, e o Marco cobre o uso real.
- **Abertura.** O aviso `picker_ready` atrasa a abertura em um ou dois quadros. O tempo limite evita que o menu deixe de abrir se o aviso não chegar.

## Premissas

- `SetWindowRgn` sobre a janela de topo do `picker` (obtida por `WebviewWindow::hwnd`) recorta o desenho e o clique da janela transparente do Tauri 2.12 no Windows 11. A Fase 1 confirma essa premissa.
- O usuário aceita que, dentro da margem da sombra (poucos pixels em volta do cartão), o clique feche o menu sem chegar ao programa de trás. Nos intervalos entre colunas isso já acontece hoje.

## Estratégia de validação

- **Automática:**
  - `npm run test:rust`, com os testes de `cascade` atualizados para o novo referencial e novos testes dos retângulos da região;
  - `npm run lint:rust` e `cargo fmt --check`;
  - `npm run test`, com os testes do `Picker` atualizados para a posição da coluna principal e o aviso `picker_ready`;
  - `npm run build`.
- **Técnica, pelo agente, no `npm run tauri -- dev`:**
  - a janela do `picker` tem o tamanho da área útil e não muda de tamanho nem de posição durante a navegação (conferido pelo retângulo da janela via Win32);
  - a região acompanha as colunas abertas.
- **Manual, pelo usuário, no instalador de teste:** ausência do pisca-pisca, clique fora, bordas da tela, modo clique, teclado e colagem.

## Fase 1 — Prova técnica da região

- [x] Adicionar a feature `Win32_Graphics_Gdi` ao crate `windows`.
- [x] Em `picker::show`, ocupar a área útil e aplicar uma região com o retângulo da coluna principal.
- [x] No `npm run tauri -- dev`, conferir:
  - o menu aparece só no cartão principal;
  - um clique fora dele ativa a janela de trás (conferido pela janela em primeiro plano via Win32);
  - nenhum artefato visível.

Critério:
- a janela do `picker` tem o tamanho da área útil e a região com o retângulo esperado (conferidos por `GetWindowRect` e `GetWindowRgnBox`);
- um clique simulado fora do cartão chega à janela de trás e fecha o menu.

Se a região não recortar o desenho ou o clique, o plano para aqui, e eu apresento as evidências para decisão.

Resultado técnico (área útil de 1920 × 1032, escala 1, com pastas de teste num banco temporário e o atalho de teste Ctrl+Alt+F11, porque o Alt+Q está ocupado nesta máquina; o banco original foi restaurado):
- com o menu aberto em (400, 300), a janela ficou em (0, 0, 1920, 1032) e a região em (384, 292)–(756, 764), que é o cartão com a margem da sombra; o menu ficou em primeiro plano;
- na captura de tela, só o cartão aparece, com sombra inteira, e o resto da tela continua visível;
- o clique na barra de título do cadastro, fora da região, pôs o cadastro em primeiro plano e fechou o menu.

## Fase 2 — Geometria e região na cascata

- [x] `cascade::arrange`: colunas relativas à área útil e retângulos físicos da região (colunas visíveis com a margem da sombra, limitados à área útil).
- [x] Atualizar e acrescentar os testes de `cascade`:
  - posições relativas à área útil;
  - coluna principal parada;
  - região com as colunas visíveis e sem as escondidas;
  - escala 1,5;
  - coordenadas negativas.
- [x] `picker::layout`: aplicar a região, sem `set_size` nem `set_position`.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

Resultado técnico: os três passam (88 testes no Rust).

## Fase 3 — Abertura e frontend

- [x] `picker-opened` com a posição da coluna principal.
- [x] Novo comando `picker_ready`, que aplica a região da coluna principal; `show` mostra e foca a janela com a região vazia e agenda o tempo limite de 150 ms, que aplica a região se o aviso não chegar.
- [x] `src/api.ts`, `src/test/fakeApi.ts` e `src/Picker.tsx`:
  - coluna principal na posição recebida;
  - `picker_ready` após o próximo quadro desenhado;
  - modo clique com a mesma posição.
- [x] Testes do `Picker` atualizados e novos casos:
  - posição da coluna principal a cada abertura;
  - aviso de pronto.

Critério:
- `npm run test` e `npm run build` passam;
- no `npm run tauri -- dev`, durante a navegação na cascata, o retângulo da janela não muda (conferido por `GetWindowRect` antes e depois de abrir e fechar colunas);
- o menu abre, navega e cola.

Resultado técnico:
- `npm run test` (148) e `npm run build` passam;
- passando o mouse pela coluna principal e abrindo até três colunas, a região mudou cinco vezes, e a janela continuou em (0, 0, 1920, 1032) o tempo todo;
- pelo teclado (`→`, `→`, `↓`, `←`, `←`), a região acompanhou as colunas (3, 4, 3 e 1 retângulos), sem mudar a janela, e o `Esc` fechou o menu;
- perto do canto inferior direito, a subcoluna abriu à esquerda e subiu, como antes;
- no modo "Clicar para abrir", entrar numa pasta não mudou nem a janela nem a região;
- em cinco aberturas seguidas, a região da coluna principal já estava aplicada na primeira leitura, menos de 50 ms depois do atalho, ou seja, antes do tempo limite;
- a colagem não foi exercitada pelo agente, para não colar texto em outro programa; o fluxo de colagem não foi alterado e fica para o Marco.

## Fase 4 — Validação técnica, documentação e instalador de teste

- [x] `npm run test`, `npm run build`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check`.
- [x] Atualizar `docs/telas.md` (Tela 2) e `docs/mvp.md` (janela `picker` e módulo `cascade`).
- [x] Registrar a correção no `CHANGELOG.md` (`Fixed`, em `[Unreleased]`).
- [x] Gerar o instalador de teste e copiá-lo para `releases/teste/` sem substituir arquivos existentes.

Critério: todas as verificações passam, e o instalador de teste está em `releases/teste/`.

Resultado técnico:
- `npm run test` (148), `npm run build`, `npm run lint`, `npm run test:rust` (88), `npm run lint:rust` e `cargo fmt --check` passam;
- instalador de teste: `releases/teste/CSTM_0.11.2-teste-075-20261014-1250_x64-setup.exe`.

## Marco — Validação do usuário

- [x] Navegar entre pastas e subpastas na cascata, passando o mouse por várias pastas seguidas: as colunas abrem e fecham sem piscar, tremer ou mostrar áreas vazias.
- [x] Abrir o menu perto da borda direita e perto da borda inferior: as colunas abrem à esquerda ou sobem, como antes, sem piscar.
- [x] Clicar fora dos cartões, sobre outro programa: o menu fecha e o clique chega ao programa (por exemplo, posiciona o cursor num editor).
- [x] A sombra dos cartões aparece inteira, sem cortes.
- [x] Abrir o menu várias vezes seguidas: ele aparece junto ao cursor, na raiz, sem mostrar por um instante o conteúdo anterior.
- [x] Teclado (`↑`, `↓`, `→`, `←`, `Enter`, `Esc`), busca e colagem funcionam como antes.
- [x] Em Configurações, "Clicar para abrir": o menu funciona como antes.

Resultado: validado pelo usuário no instalador de teste `CSTM_0.11.2-teste-075-20261014-1250_x64-setup.exe`; aceite explícito em 2026-10-14.
