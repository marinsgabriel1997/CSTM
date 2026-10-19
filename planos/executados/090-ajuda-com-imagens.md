# 090 — Ajuda com imagens

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-19
- Concluído em: 2026-10-19

## Objetivo

Deixar a Ajuda mais fácil de seguir e de achar: menos texto e imagens das telas, com bordas vermelhas no que o usuário deve ver e números na ordem dos cliques, revisão do português, busca nos tutoriais e um acesso à Ajuda que não passe despercebido.

## Contexto

- A Ajuda (Tela 4 de `docs/telas.md`, `src/components/HelpPage.tsx`) tem duas abas: **Básico**, com 6 passos numerados, e **Avançado**, com seções de parágrafos. O conteúdo fica em `src/helpContent.ts` e só tem texto.
- Os protótipos em `docs/prototipo/` (`cadastro.html`, `picker.html`, `configuracoes.html`, `ajuda.html`) desenham as telas com fidelidade e aceitam o estado e o tema pela URL (`#estado=...&tema=...`). O `ajuda.html` desenha o menu da bandeja.
- O Edge está instalado nas máquinas de desenvolvimento e roda sem janela (`--headless`); o Node 24 do projeto tem `WebSocket` nativo, o que permite controlar o Edge pelo protocolo de depuração (CDP) sem dependência nova.

## Escopo

1. **Imagens:** uma por passo do Básico e uma nas seções do Avançado em que a tela ajuda (Busca; Favoritos e Mais usados; Modos de colagem; Histórico do clipboard; Organizar a árvore; Lixeira; Importar e exportar; Configurações). As seções só de regras (Textos no menu de colagem, Menu de colagem pelo teclado, Desinstalar e apagar os dados, Limites do Windows) continuam só com texto.
2. **Marcação:** retângulo vermelho arredondado em volta de cada alvo e, quando há ordem de cliques, um círculo vermelho numerado (1, 2, 3) junto ao alvo. O texto do passo cita os mesmos números.
3. **Tema:** imagens só no tema claro, nos dois temas do aplicativo.
4. **Textos:** os textos de `helpContent.ts` ficam mais curtos onde a imagem mostra o caminho, sem perder informação que a imagem não mostra (atalhos, regras).
5. **Geração reproduzível:** `npm run ajuda:imagens` regenera todas as imagens a partir dos protótipos.
6. **Revisão do português** (aprovada item a item com o usuário): introdução nova da Ajuda ("O CSTM salva textos para você reutilizar rapidamente em qualquer programa, sem precisar ficar copiando do Bloco de Notas."), frases mais naturais no Básico e no Avançado, e "área de transferência" no lugar de "clipboard" na Ajuda e nas Configurações ("Guardar o histórico da área de transferência" e as mensagens de erro do histórico). O Sobre e a apresentação da biblioteca vazia trocam "Cadastre os textos que você digita toda hora…" por frases no mesmo tom da introdução.
7. **Páginas no painel e Ajuda em destaque:** Ajuda, Configurações e Sobre o CSTM saem da barra inferior e viram linhas no rodapé do painel da árvore, abaixo da Lixeira, com ícone e nome, no mesmo estilo da linha da Lixeira; a página aberta marca a linha dela como selecionada. A barra inferior fica só com o estado do salvamento, as contagens e a versão. Até a pessoa abrir a Ajuda por conta própria pela primeira vez (clique, `F1` ou bandeja; a abertura automática da primeira execução não conta), a linha Ajuda fica na cor de destaque, com um brilho que a atravessa a cada 4 s; depois, fica como as outras. Com "reduzir movimento" no Windows (`prefers-reduced-motion`), fica só a cor, sem o brilho.

8. **Busca na Ajuda:** campo **Buscar na Ajuda** acima das abas; título, busca e abas ficam parados no topo enquanto o conteúdo rola. A busca vale para as duas abas, sem diferenciar acentos nem maiúsculas, destaca as ocorrências (a atual com mais ênfase), mostra "N de M" (ou "Nenhum resultado") e, ao lado do nome de cada aba, quantas ocorrências ela tem. `Enter` ou ↓ vai para a próxima e `Shift+Enter` ou ↑ para a anterior, na ordem Básico e depois Avançado, trocando de aba quando a próxima está na outra e rolando até ela; `Esc` limpa a busca. As descrições das imagens não entram na busca.

Fora do escopo: imagens no tema escuro, ampliar a imagem ao clicar, mudanças nas telas do aplicativo além da Ajuda, dos textos citados e do botão Ajuda.

## Estado desejado (técnico)

- `scripts/ajuda-imagens.mjs` (Node, sem dependência nova; o ESLint do projeto cobre só `.ts`/`.tsx`):
  - abre o Edge headless com `--remote-debugging-port` e perfil temporário, e o controla por CDP;
  - para cada captura de uma lista no próprio script: abre o protótipo no estado indicado, tema claro, numa janela de tamanho fixo; executa ações simples quando o estado não basta (por exemplo, `hover`); recorta pela caixa de um seletor CSS (com margem); desenha as marcações por seletor CSS, para acompanhar mudanças de layout;
  - grava WebP (`Page.captureScreenshot`, com escala 2 para nitidez em telas de alta resolução) em `src/assets/ajuda/<nome>.webp`;
  - falha com mensagem clara quando um seletor não existe, sem gravar imagem parcial.
- `package.json`: script `ajuda:imagens`.
- `helpContent.ts`: `HelpStep` e `HelpSection` ganham `image?: HelpImage` (`{ src: string; alt: string }`), com as imagens importadas pelo Vite.
- `preferences.ts`: `helpButtonSeen: boolean` (padrão `false`, leitura tolerante), gravado como `true` quando a pessoa abre a Ajuda pelo botão, por `F1` ou pela bandeja; a abertura automática da primeira execução não grava. É preferência de interface do WebView, não dado do usuário.
- `StatusBar.tsx` sem os botões das páginas; `TreePane.tsx` com as linhas Ajuda, Configurações e Sobre o CSTM abaixo da Lixeira, com o destaque da Ajuda (cor de marca, fundo suave e brilho em `::after` com animação de 4 s, desligada em `@media (prefers-reduced-motion: reduce)`) enquanto `helpButtonSeen` for `false`.
- `HelpPage.tsx`: busca com destaque por `<mark>` sobre o texto já marcado (sem HTML bruto), contadores por aba e navegação; imagem abaixo do texto do passo ou dos parágrafos da seção, na largura da coluna (sem ampliar além do tamanho natural), com borda leve e cantos arredondados, `alt` descritivo e `loading="lazy"`. As capturas têm o dobro de pixels: a imagem usa só `srcSet="<url> 2x"` (sem `src`, que entraria como candidata 1x e a mostraria com o dobro do tamanho).

## Riscos

- **Protótipo diferente do aplicativo:** detalhes do protótipo podem divergir do aplicativo (versão na barra inferior, textos de exemplo). As capturas mostram dados de exemplo neutros; o Marco confere no aplicativo.
- **Imagens desatualizadas:** quando uma tela mudar, as imagens precisam ser regeneradas; a regra entra no `AGENTS.md`.
- **Tamanho do instalador:** cresce algumas centenas de KB com as imagens em WebP.
- **Tema escuro:** as imagens claras aparecem também no tema escuro; a borda leve separa a imagem da página.
- **Script só no Windows:** depende do Edge instalado; é ferramenta de desenvolvimento e não entra no aplicativo.

## Premissas

- Versão da entrega: 0.21.0 (MINOR, melhoria visível da Ajuda).
- Os protótipos são a fonte das telas; quando uma captura precisar de um estado que o protótipo não tem, o estado é acrescentado ao protótipo.

## Estratégia de validação

- Script: rodar `npm run ajuda:imagens` do zero e conferir cada imagem gerada (recorte, nitidez, marcações no alvo certo).
- Frontend: `npm run test`, `npm run build` e `npm run lint`; testes de que os passos e as seções com imagem a mostram com o `alt`.
- Visual: protótipo `ajuda.html` com as imagens; depois, o aplicativo num build de teste.

## Fase 0 — Desenho

- [x] `docs/telas.md`, Tela 4: imagens nos passos e nas seções, marcação vermelha e numerada, textos curtos.
- [x] `docs/prototipo/ajuda.html`: abas com as imagens geradas e os textos novos (com a marcação `[n]` como círculo vermelho) e o estado **Bandeja: Sair**, com a barra de tarefas e o ícone do CSTM, para a imagem do passo 6.

Critério: desenho registrado e coerente com o escopo.

## Fase 1 — Script e imagens

- [x] `scripts/ajuda-imagens.mjs` e o script `ajuda:imagens` no `package.json`.
- [x] Estados que faltarem nos protótipos para as capturas: só a cena da bandeja (acima). O `picker.html` não rodava (duas quebras de linha literais em strings do Histórico, do plano 086) e foi corrigido.
- [x] Imagens geradas em `src/assets/ajuda/` e conferidas uma a uma (14 imagens, 15 a 90 KB cada, cerca de 0,6 MB no total).

Critério: `npm run ajuda:imagens` roda do zero sem erro e produz todas as imagens da lista. Resultado: 14 imagens geradas; um alvo inexistente aborta com mensagem clara, sem gravar imagem.

## Fase 2 — Interface

- [x] `helpContent.ts` com as imagens e os textos encurtados, e a marcação `[n]` para os números.
- [x] `HelpPage.tsx` mostrando as imagens e o círculo vermelho das marcações `[n]`.
- [x] Testes da Ajuda cobrindo as imagens (`src/components/HelpPage.test.tsx`, novo).

Critério: `npm run test`, `npm run build` e `npm run lint` passando. Resultado: 272 testes passando, build e lint sem erro.

## Fase 3 — Documentação

- [x] Guia `docs/ajuda.md` com o padrão dos tutoriais (texto, marcação `[n]`, imagens, marcações, formato das capturas, conferência), referenciado no `AGENTS.md`, na Tela 4 e em `helpContent.ts`; opção `--prototipo` do script para sincronizar o texto do `ajuda.html`.
- [x] `CHANGELOG.md` (`Changed`), `AGENTS.md` (comando `ajuda:imagens` e quando regenerar as imagens) e `docs/produto.md`, se citar o conteúdo da Ajuda.

Critério: documentação revisada e coerente com o código.

## Fase 4 — Revisão de textos e botão Ajuda

- [x] Textos revisados em `helpContent.ts`, `AboutPage.tsx`, `Editors.tsx` (apresentação) e `SettingsPage.tsx`, com os protótipos `ajuda.html`, `sobre.html`, `cadastro.html` e `configuracoes.html` e os desenhos em `docs/telas.md`. Resultado: 272 testes passando, build e lint sem erro.
- [x] Protótipo `cadastro.html`: linhas Ajuda, Configurações e Sobre o CSTM abaixo da Lixeira e o estado **Ajuda em destaque**.
- [x] Protótipos `ajuda.html`, `configuracoes.html` e `sobre.html` com as linhas no painel e a barra inferior sem os botões (o estado de destaque provisório na barra inferior do `ajuda.html` sai); `docs/telas.md` (Tela 1, barra inferior, Páginas na área do editor e Tela 4).
- [x] `preferences.ts`, `TreePane.tsx`, `StatusBar.tsx` e `App.tsx` com as linhas no painel e o destaque (`src/PagesPanel.test.tsx`, novo); testes: destaque até a primeira abertura pelo botão, por `F1` e pela bandeja, sem contar a abertura automática, e lembrado depois.
- [x] Imagens regeneradas onde o painel ou a barra inferior aparecem, com a captura das Configurações marcando a linha Configurações no painel; textos da Ajuda que citam "engrenagem" e "barra inferior" ajustados.

Critério: `npm run test`, `npm run build` e `npm run lint` passando; imagens regeneradas e conferidas. Resultado: atendido (ver Fase 5).

## Fase 5 — Busca na Ajuda e tamanho das imagens

- [x] Protótipo `ajuda.html`: estado **Busca**, com o campo, os contadores por aba, anterior/próxima e o cabeçalho parado; imagens com `srcset` 2x.
- [x] Recortes das capturas do painel (`basico-3-pastas`, `avancado-busca`, `avancado-arvore`, `avancado-importar`) sem o espaço vazio até a Lixeira; imagens regeneradas e conferidas.
- [x] `HelpPage.tsx` com a busca e as imagens em 2x; `docs/telas.md` (Tela 4). O campo de busca se explica sozinho; a Ajuda não ganhou texto sobre ele.
- [x] Testes: correspondências nas duas abas, contadores por aba, próxima/anterior trocando de aba, sem diferenciar acentos, `Esc` limpando.

Critério: `npm run test`, `npm run build` e `npm run lint` passando. Resultado: 287 testes passando (duas rodadas completas), build e lint sem erro. Dois testes que abrem dois diálogos seguidos falhavam às vezes (também no HEAD, com menos frequência): o Tabster esconde com `aria-hidden` um diálogo aberto até 250 ms depois de outro fechar; os testes passaram a esperar esse intervalo (`src/test/dialogs.ts`), sem mudar o que verificam.

## Marco — Validação do usuário

- [x] No protótipo `docs/prototipo/ajuda.html`: imagens nítidas, marcações claras e na ordem certa, textos curtos e suficientes.
- [x] No protótipo `ajuda.html`, estado **Busca**: busca nas duas abas, contadores, anterior/próxima e cabeçalho parado.
- [x] No protótipo `cadastro.html`, estado **Ajuda em destaque**: linhas no rodapé do painel, cor e brilho da Ajuda adequados nos dois temas.
- [x] No aplicativo (build `0.21.0-teste-090`): Básico e Avançado mostram as imagens no tamanho real (não ampliadas), nos temas claro e escuro, sem distorção na janela no tamanho mínimo; textos revisados; linhas Ajuda, Configurações e Sobre no painel; Ajuda em destaque até a primeira abertura e normal depois, inclusive após reiniciar o CSTM.

Resultados:

- Tutoriais (imagens, marcações e textos) aceitos em 2026-10-19 ("os tutoriais ficaram perfeitos"), com o pedido de documentar o padrão (`docs/ajuda.md`).
- Protótipos da busca (estado **Busca**) e do painel (estado **Ajuda em destaque**) aprovados em 2026-10-19.
- Build `0.21.0-teste-090` (primeiro): imagens grandes demais numa tela 4K — as capturas em 2x eram mostradas como 1x, e as do painel incluíam o espaço vazio até a Lixeira. Corrigido na Fase 5. Pedidos novos: busca nos tutoriais (Fase 5) e Ajuda, Configurações e Sobre no painel (Fase 4).

Aceite: todas as verificações aprovadas pelo usuário em 2026-10-19 ("tudo aprovado").
