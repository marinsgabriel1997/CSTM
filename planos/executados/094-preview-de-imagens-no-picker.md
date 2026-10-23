# 094 — Preview das imagens do Histórico no menu de colagem

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-23
- Concluído em: 2026-10-23

## Objetivo

Mostrar a imagem inteira de um item do Histórico no menu de colagem, para identificar uma imagem copiada sem depender da miniatura de 24 × 20 px da linha.

## Contexto

- No menu de colagem, a imagem do Histórico aparece só como miniatura na linha (`styles.thumbnail`, 24 × 20, gerada da miniatura de 64 px gravada no banco, `THUMBNAIL_SIZE` em `clipboard.rs`) e com "Imagem L × A" no título e na dica.
- O PNG completo já está disponível ao frontend por `api.getClipboardItem(id)` (`ClipboardDetail.image`, `data:` URL), usado hoje pelo cadastro.
- O menu é desenhado em cartões dentro de uma janela transparente do tamanho da área útil, recortada em volta dos cartões visíveis (`cascade.rs`, `layout_picker`). As subcolunas têm 380 de largura, começam no topo da coluna principal e abrem à direita da anterior; sem espaço, à esquerda; senão, encostadas na borda direita (Tela 2, Navegação nas pastas, regras 6 a 8).
- Os textos já têm o conteúdo completo na dica (`title`) da linha.

## Decisões tomadas com o usuário

- O preview é um **cartão novo ao lado da coluna** em que está a imagem, não um painel dentro da coluna, um popover ou miniaturas maiores.
- O cartão aparece **só enquanto uma imagem do Histórico está selecionada** (pelo teclado ou pelo mouse) e fecha ao selecionar outro item, como as subcolunas da cascata.
- Só **imagens** têm preview. Textos (cadastrados ou do Histórico) continuam só com a dica atual, que é **mantida** também para as imagens.
- O cartão segue a **mesma regra de posição das subcolunas**: à direita da coluna; sem espaço, à esquerda; senão encostado na borda direita.
- O cartão mostra a **imagem completa, buscada sob demanda** com `getClipboardItem`, sem mudança no banco.
- Quando o cartão **não cabe nem à direita nem à esquerda** da coluna da imagem (telas estreitas, abaixo de uns 760 px lógicos, ou o caso da tela simulada do protótipo), o preview **não aparece**, em vez de encostar na borda direita e cobrir a própria lista.

## Decisões de execução

- O cartão é pedido ao `layoutPicker` como mais uma subcoluna, logo depois da coluna da imagem (a imagem sempre está na coluna mais profunda, porque selecionar um item fecha as colunas à direita dele). Assim ele herda a largura de 380, a posição, o topo, o limite inferior e o recorte da janela. Vale nos dois modos de navegação: no modo clique, o Histórico fica na coluna principal e o cartão é a única "subcoluna".
- Contrato: `Subcolumn` (Rust) e `PickerSubcolumn` (TypeScript) ganham o campo opcional `optional` (padrão `false`, compatível com os pedidos atuais). Uma subcoluna opcional abre à direita da anterior ou, sem espaço, à esquerda, pela regra atual. Se não couber de nenhum lado, volta com `hidden: true`, fica fora da região da janela e não esconde nenhuma outra coluna. O frontend não desenha uma coluna opcional escondida.
- Conteúdo do cartão: a imagem inteira ajustada à largura útil do cartão (sem ampliar além do tamanho natural), centralizada, e abaixo a legenda "L × A" em cinza (`Caption1`). A altura pedida é a da imagem ajustada mais a legenda e as margens; se passar da área útil, `arrange` limita a altura e a imagem é reduzida para caber (`object-fit: contain`), sem rolagem.
- Enquanto o PNG completo carrega, o cartão mostra a miniatura atual ampliada no mesmo espaço. Se a busca falhar, a miniatura continua.
- Cache em memória dos PNGs já buscados, descartado a cada abertura do menu. Respostas fora de ordem (seleção já trocada) são descartadas.
- O cartão não é interativo: não recebe foco nem muda a seleção, e clicar nele não fecha o menu nem cola. Ele não entra na navegação por `→` e `←`.
- Imagem para leitores de tela com `alt` "Imagem L × A".
- Versão MINOR (funcionalidade compatível): 1.1.0 no commit de entrega. O instalador de teste usa `1.1.0-teste-094`.

## Escopo

- `docs/prototipo/picker.html`: o cartão de preview ao selecionar uma imagem do Histórico, nos dois modos.
- `docs/telas.md` (Tela 2): a regra do cartão de preview.
- `src-tauri/src/cascade.rs`: o campo `optional` e a regra sem espaço, com testes.
- `src/api.ts` e `src/test/fakeApi.ts`: o campo `optional` no contrato e na implementação em memória (com um meio de simular a falta de espaço).
- `src/Picker.tsx`: o cartão, o pedido de layout e o carregamento da imagem.
- `src/Picker.test.tsx` e, se preciso, `src/test/fakeApi.ts`: testes do comportamento.
- `src/helpContent.ts`: a seção do Histórico menciona o preview.
- `docs/produto.md`: se descrever o Histórico no menu, atualizar.
- `CHANGELOG.md`: entrada em `[Unreleased]`, categoria `Added`.

Fora do escopo: banco, miniaturas gravadas, preview de textos, preview no cadastro.

## Estado desejado

- Selecionar uma imagem do Histórico (setas ou mouse) abre o cartão com a imagem inteira ao lado da coluna; selecionar outro item ou fechar a coluna do Histórico o fecha.
- As regras de posição, topo e recorte das subcolunas valem para o cartão, exceto no caso sem espaço dos dois lados, em que ele não aparece.
- Os textos e a navegação do menu se comportam como antes.

## Riscos e premissas

- Imagens grandes (vários MB em `data:` URL) podem demorar um instante para chegar. A miniatura cobre a espera, e o cache evita repetir a busca.
- Passar o mouse rápido sobre várias imagens dispara várias buscas. As obsoletas são descartadas, sem bloquear a interface.
- Premissa: um cartão com a largura das subcolunas (380) é suficiente para identificar a imagem.
- Os testes do frontend usam `fakeApi` e não cobrem o recorte real da janela. Posição e recorte exigem validação no Windows.

## Estratégia de validação

- `npm run test`, `npm run build` e `npm run lint`.
- Backend: `npm run test:rust` (com testes novos da coluna opcional), `npm run lint:rust` e `cargo fmt --check`.
- Instalador de teste em `releases/teste/` e validação do usuário no Windows (Marco).

## Fase 1 — Protótipo e desenho

- [x] `docs/prototipo/picker.html`: cartão de preview ao selecionar a imagem do Histórico, nos dois modos; sem espaço dos dois lados, o preview não aparece. A tela simulada (900 px) não tem espaço para três cartões, por isso a cascata mostra o caso sem espaço e o modo clique ganha o estado "Imagem do Histórico", com o menu junto à borda esquerda, para mostrar o cartão. O estado "Histórico" usado pela captura da Ajuda não muda.
- [x] `docs/telas.md`: a regra do cartão na Tela 2 (Estrutura e Navegação nas pastas).

Critério: simulação do protótipo (jsdom, teclado) mostra o cartão ao selecionar a imagem no estado "Imagem do Histórico", o esconde ao selecionar um texto e não o mostra sem espaço.

## Fase 2 — Coluna opcional no backend

- [x] `cascade.rs`: campo `optional` em `Subcolumn` e regra sem espaço; testes: opcional à direita, opcional à esquerda, opcional sem espaço (escondida, fora da região, sem esconder outras) e pedido sem o campo (padrão).

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam. Resultado: 197 testes passam (4 novos em `cascade::tests`), clippy e fmt sem apontamentos.

## Fase 3 — Implementação no menu

- [x] `src/Picker.tsx`: estado da imagem selecionada, pedido de layout com o cartão, renderização do cartão, carregamento com cache e descarte de respostas obsoletas.
- [x] `src/api.ts` e `src/test/fakeApi.ts`: campo `optional`.
- [x] Testes em `src/Picker.test.tsx`: o cartão aparece com a imagem selecionada (teclado e mouse), mostra a miniatura e depois a imagem completa, mostra "L × A", some ao selecionar um texto e não aparece para textos; nos dois modos de navegação; o pedido de layout marca o cartão como opcional; sem espaço, o cartão não aparece.

Critério: `npm run test`, `npm run build` e `npm run lint` passam. Resultado: 298 testes passam (8 novos em "preview de imagem do Histórico"), build e lint sem erros.

## Fase 4 — Documentação e instalador de teste

- [x] `src/helpContent.ts`, `docs/produto.md` (se aplicável) e `CHANGELOG.md`.
- [x] Instalador `1.1.0-teste-094` em `releases/teste/` (`releases/teste/CSTM_1.1.0-teste-094_x64-setup.exe`).

Critério: validações verdes e instalador gerado. Resultado: atendido.

## Marco — Validação do usuário

- [x] No Histórico (modo cascata), selecionar uma imagem com as setas: o cartão abre ao lado com a imagem inteira e "L × A"; selecionar um texto o fecha.
- [x] Passar o mouse sobre imagens e textos do Histórico: o cartão acompanha a seleção sem piscar a janela.
- [x] Com o menu perto da borda direita da tela, o cartão abre à esquerda, como as subcolunas.
- [x] (Se possível, numa tela estreita ou com escala alta) Sem espaço dos dois lados, o preview não aparece e a lista continua visível.
- [x] No modo clique (Configurações > navegação), o cartão abre ao lado da coluna principal com o Histórico aberto.
- [x] Imagem grande (ex.: captura de tela inteira): aparece a miniatura e logo a imagem completa; colar e copiar continuam funcionando.
- [x] Clicar no cartão não fecha nem cola; clicar fora fecha o menu, como antes.
- [x] Aceite final.

Resultado: validado pelo usuário no Windows com o instalador `1.1.0-teste-094` em 2026-10-23. Um primeiro relato de que o preview não abria vinha do CSTM de outra máquina, aberta por acesso remoto, que recebia o atalho; não era defeito da entrega.
