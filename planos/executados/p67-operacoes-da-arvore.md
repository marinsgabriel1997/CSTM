# p67 — Operações da árvore

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Dar à árvore do cadastro as operações comuns de um gerenciador de arquivos: seleção múltipla com ações em lote, arrastar e soltar, ordenar, recortar/copiar/colar (que também duplica), lixeira com desfazer e navegação por teclado; mostrar o uso de cada texto; e levar ao menu de colagem as pastas **Mais usados** e **Favoritos**.

## Contexto

A árvore (p30) seleciona um item por vez e oferece, pelo menu de contexto e por atalhos: Renomear (F2), Mover para… (Ctrl+M), Mover para cima/baixo (Alt+↑/↓), favoritar, Exportar (pastas, p65) e Excluir (Del, com confirmação e sem volta). Não há arrastar, ordenação automática, duplicação, desfazer nem lixeira. O banco (`0001_initial.sql`) guarda `sort_order` por grupo e `use_count`/`last_used_at` por texto; `ON DELETE CASCADE` apaga o conteúdo das pastas. O menu de colagem (p50) mostra na raiz as seções **Favoritos** e **Todos**. No Windows, a janela do Tauri intercepta arrastos (`dragDropEnabled`, ativo por padrão), o que impede o arrastar e soltar HTML5 no WebView2.

## Decisões

1. **Seleção múltipla:** Ctrl+clique alterna um item; Shift+clique e Shift+↑/↓ selecionam o intervalo na ordem visível; Ctrl+A seleciona todos os itens visíveis; Esc volta à seleção de um item. Clique direito num item fora da seleção seleciona só ele; dentro da seleção, o menu age sobre todos. Se uma pasta e itens dentro dela estiverem selecionados, as ações valem para a pasta (os de dentro vão junto).
2. **Painel de seleção:** com mais de um item selecionado, o editor dá lugar a "N itens selecionados" (contagem de textos e pastas) com Mover para…, Recortar, Copiar, Adicionar/Remover dos favoritos (quando há textos), Exportar e Excluir. Renomear e Mover para cima/baixo ficam indisponíveis. As pendências do editor são gravadas antes de entrar no painel.
3. **Arrastar e soltar:** soltar sobre uma pasta move para dentro dela (fim do grupo); soltar entre itens reordena naquela posição, com linha indicadora, respeitando pastas antes de textos (a linha só aparece em posições válidas). Ctrl ao soltar copia em vez de mover, como no Explorer. Parar sobre uma pasta fechada por 700 ms a abre; arrastar perto das bordas rola a árvore. Soltar uma pasta em si mesma ou numa descendente não é permitido. Arrastar um item selecionado leva a seleção inteira. Esc cancela. Soltar sobre a Lixeira exclui. `dragDropEnabled` é desligado na janela `main` (arrastar do Explorer está fora do escopo desde o p65).
4. **Ordenar:** submenu **Ordenar** no menu de contexto da pasta e no botão `...` (raiz): Por nome (A–Z), Por mais usados, Por uso mais recente. É uma ação única que regrava a ordem manual dos itens diretos (não das subpastas); pastas sempre por nome, textos pelo critério escolhido, empates por nome. A ordem manual continua editável depois, e o menu de colagem segue a nova ordem.
5. **Somente atalhos consagrados:** as operações novas usam apenas atalhos que funcionam igual em qualquer programa do Windows: Ctrl+clique, Shift+clique, Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+Z, Del, Shift+Del, F2, Enter, Esc, setas, Home/End e digitar letras para saltar. Nenhum atalho novo é criado; o restante fica nos menus. Dos atalhos existentes, continuam os conhecidos (Ctrl+N, Ctrl+Shift+N, Ctrl+S, F2, Del) e saem Ctrl+M e Alt+↑/↓, para facilitar a entrada de novos usuários; Mover para…, Mover para cima e Mover para baixo continuam no menu de contexto, sem atalho.
6. **Recortar, copiar e colar (e duplicar):** Ctrl+X e Ctrl+C (e Recortar/Copiar nos menus) marcam os itens selecionados; Ctrl+V (e Colar) cola no destino do `+ Novo` (pasta selecionada, pasta do texto selecionado ou raiz). Recortados são movidos; copiados são duplicados com todo o conteúdo, logo após os itens do grupo. Duplicar é copiar e colar na mesma pasta: nesse caso o nome recebe " - Cópia" (depois " - Cópia (2)"…), como no Explorer; em outra pasta, o nome se mantém. A cópia é um item novo: sem favorito e com uso zerado. Itens recortados aparecem esmaecidos até colar; Esc desfaz o recorte (os itens voltam ao normal e nada é movido) antes de qualquer outro efeito do Esc, como reduzir a seleção múltipla. A marcação fica no app; além dela, copiar um único texto põe o conteúdo dele no clipboard do Windows, para colar em outro programa. Copiar não conta como uso.
7. **Menus:** o menu de contexto ganha Recortar, Copiar e Colar (Colar só quando há itens marcados); não há item nem atalho separados para duplicar ou para copiar o conteúdo.
8. **Lixeira:** Excluir (Del) move para a lixeira sem confirmação, com a notificação "N itens movidos para a lixeira." e o botão **Desfazer**. Shift+Del exclui definitivamente, com confirmação. A **Lixeira (N)** é um item fixo no fim da árvore, que aceita itens soltos sobre ela; selecioná-la mostra no lugar do editor a lista dos itens excluídos (título ou nome, pasta de origem, data da exclusão) com Restaurar e Excluir definitivamente por item (e em lote pela seleção múltipla da lista) e o botão **Esvaziar lixeira**, com confirmação. Restaurar devolve o item à pasta de origem no fim do grupo; se a pasta de origem estiver na lixeira ou não existir mais, à raiz. Itens na lixeira não aparecem na árvore, na busca, no menu de colagem, nos totais nem nas exportações, e não são apagados automaticamente.
9. **Persistência da lixeira:** migração `0003` acrescenta `deleted_at` a `folders` e `snippets`; excluir uma pasta marca só a pasta (o conteúdo fica oculto por ela e volta junto ao restaurar). Excluir definitivamente apaga as linhas, com o `CASCADE` existente; a confirmação informa o conteúdo afetado. A busca filtra os itens excluídos e os que estão dentro de pastas excluídas.
10. **Desfazer (Ctrl+Z):** pilha da sessão (até 50 ações, perdida ao encerrar o app) para excluir, mover (Mover para…, arrastar, recortar e colar), reordenar (Mover para cima/baixo, arrastar), ordenar, colar cópias e favoritar em lote. Vale com o foco na árvore ou no painel de seleção; nos campos de texto, Ctrl+Z continua sendo o desfazer do campo. Desfazer a exclusão restaura da lixeira; desfazer cópias coladas as exclui definitivamente. Se a ação não puder mais ser desfeita (por exemplo, item excluído definitivamente), a notificação informa e a ação sai da pilha. Sem refazer.
11. **Navegação:** Expandir tudo e Recolher tudo no botão `...`; digitar letras com o foco na árvore salta para o próximo item visível que começa com elas; Enter num texto leva o foco ao conteúdo do editor e numa pasta a abre ou fecha.
12. **Uso no editor:** abaixo do título, em cinza, "Usado 12 vezes · último uso em 10/10/2026" ou "Ainda não usado".
13. **Menu de colagem:** a raiz passa a mostrar, nesta ordem e sem cabeçalhos de seção, as pastas virtuais **Mais usados** (os 10 textos com mais usos, ao menos um uso, empates pelo uso mais recente) e **Favoritos** (por título), cada uma oculta quando vazia e com ícone próprio, seguidas das pastas e textos da raiz. Dentro delas, cada texto mostra à direita a pasta em que está, como na busca.
14. **Busca e filtro:** com busca ou filtro de favoritos ativos, arrastar, Mover para cima/baixo e Ordenar ficam indisponíveis (a ordem mostrada é parcial); as demais operações continuam.

## Escopo

- Banco: migração `0003` (`deleted_at`); consultas, busca, contagens, picker e exportação ignorando a lixeira; operações de lixeira (listar, restaurar, excluir definitivamente, esvaziar), copiar itens (recursivo), ordenar e aplicar uma ordem (para desfazer), mover em lote; testes.
- Comandos Tauri correspondentes; `api.ts` e `src/test/fakeApi.ts`.
- Frontend: seleção múltipla, painel de seleção, arrastar e soltar, Ordenar, recortar/copiar/colar, Lixeira e seu painel, pilha de desfazer, notificações com Desfazer, navegação por teclado, uso no editor, pastas virtuais no menu de colagem; testes.
- `tauri.conf.json`: `dragDropEnabled: false` na janela `main`.
- Desenho em `docs/telas.md` e nos protótipos `docs/prototipo/cadastro.html` e `docs/prototipo/picker.html`, aprovados antes do código.
- Documentação: `docs/mvp.md`, `docs/telas.md`, `README.md`, `CHANGELOG.md`; versão 0.9.0.

Fora do escopo: atalhos próprios (como Ctrl+D); refazer (Ctrl+Y); desfazer de renomear e de edição de texto pela pilha; apagar a lixeira automaticamente; ordenação recursiva ou como modo de exibição; arrastar de ou para o Explorer; pastas virtuais na árvore do cadastro.

## Estado desejado

1. Ctrl+clique, Shift+clique e Ctrl+A selecionam vários itens, e o painel de seleção move, copia, favorita, exporta e exclui todos de uma vez.
2. Arrastar move para pastas e reordena na posição indicada; com Ctrl, copia; arrastos inválidos não são aceitos.
3. Ordenar uma pasta reorganiza seus itens diretos pelo critério escolhido, e o menu de colagem segue a nova ordem.
4. Ctrl+X/C/V movem e copiam itens conforme a decisão 6; colar na mesma pasta duplica com " - Cópia"; copiar um texto permite colá-lo em outro programa.
5. Excluir leva à lixeira; restaurar devolve o item com o conteúdo; esvaziar e excluir definitivamente pedem confirmação. Itens na lixeira não aparecem em nenhum outro lugar.
6. Ctrl+Z desfaz as ações da decisão 10, inclusive após trocar de item.
7. O editor mostra o uso do texto; o menu de colagem mostra Mais usados e Favoritos como pastas.
8. Bancos existentes migram sem perda de dados.

## Premissas

- Com `dragDropEnabled: false`, o WebView2 entrega os eventos de arrastar e soltar HTML5 normalmente.
- O componente `Tree` do Fluent UI v9 permite controlar a seleção e os eventos de teclado necessários; se não permitir, a seleção múltipla é implementada sobre ele sem trocar de componente.

## Riscos

- Volume grande de interações novas na árvore pode conflitar com atalhos existentes (F2, Del, Ctrl+N, Ctrl+Shift+N, Ctrl+S); os atalhos são conferidos no desenho e cobertos por testes.
- Filtrar a lixeira em todas as consultas pode deixar escapar um caminho (busca, contagem, exportação, picker); cada um tem teste no backend.
- A pilha de desfazer guarda estado no frontend; ações feitas por outra janela (uso pelo picker) não entram nela e não interferem nas ações desfeitas, que só mexem em posição, pasta, favorito e lixeira.
- O escopo é grande; a execução é dividida em fases com entregas verificáveis.

## Estratégia de validação

- Backend: testes de migração, lixeira (exclusão, restauração com pasta de origem ausente ou na lixeira, exclusão definitiva, esvaziar), filtros da lixeira em listagens, busca, contagens, exportação e picker, cópia recursiva com nomes " - Cópia", ordenação e aplicação de ordem, mover em lote, mais usados.
- Frontend (Vitest): seleção múltipla, painel de seleção, arrastar (eventos simulados), ordenar, recortar/copiar/colar, lixeira, desfazer, navegação por teclado, uso no editor, pastas virtuais do picker.
- Validações oficiais: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`.
- Funcional no Windows, com o usuário: arrastar e soltar no WebView2, atalhos, lixeira e migração de um banco existente.

## Fases

### Fase 1 — Desenho

- [x] Seções novas e alteradas em `docs/telas.md` (árvore, painel de seleção, Lixeira, menus, atalhos, menu de colagem).
- [x] Estados novos em `docs/prototipo/cadastro.html` e `docs/prototipo/picker.html`.

Critério: desenho aprovado explicitamente pelo usuário. Aprovado.

### Fase 2 — Backend

- [x] Migração `0003` e filtros da lixeira em todas as consultas.
- [x] Lixeira, copiar itens, aplicar ordem (`arrange_items`, que também move em lote e desfaz); exportação de itens escolhidos; comandos, `api.ts` e `fakeApi.ts`. Ordenar e Mais usados são calculados no frontend sobre os dados já carregados.
- [x] Testes do backend.

Critério: `npm run test:rust` e `npm run lint:rust` passam.

### Fase 3 — Seleção múltipla e ações em lote

- [x] Seleção múltipla, painel de seleção e menu de contexto sobre a seleção.
- [x] Remoção dos atalhos Ctrl+M e Alt+↑/↓. Os atalhos de item (Ctrl+X/C/V/Z, Del, Shift+Del) são de janela, ignorados em campos editáveis e diálogos abertos.
- [x] Recortar, copiar e colar, inclusive o conteúdo de um texto no clipboard do Windows.
- [x] Testes.

Critério: testes do frontend passam.

### Fase 4 — Lixeira e desfazer

- [x] Lixeira na árvore e seu painel; Del, Shift+Del e esvaziar.
- [x] Pilha de desfazer e notificações com Desfazer. Os itens excluídos juntos compartilham o mesmo `deleted_at`; restaurar devolve ao fim do grupo (ou à raiz se a pasta de origem está na lixeira).
- [x] Testes.

Critério: testes do frontend passam.

### Fase 5 — Arrastar, ordenar e navegação

- [x] Arrastar e soltar (mover, reordenar, copiar, abrir pasta, rolar, soltar na Lixeira); `dragDropEnabled: false`.
- [x] Submenu Ordenar (calculado no frontend; pastas por nome, coleção `pt-BR` numérica); Expandir/Recolher tudo; salto por letras; Enter.
- [x] Testes.

Critério: testes do frontend passam.

### Fase 6 — Uso e menu de colagem

- [x] Uso no editor.
- [x] Mais usados e Favoritos como pastas no menu de colagem (Mais usados calculado no frontend).
- [x] Testes.

Critério: testes do frontend passam.

### Fase 7 — Documentação e validação técnica

- [x] Documentação e CHANGELOG atualizados; versão 0.9.0.
- [x] Validações automatizadas executadas (121 testes do frontend, 70 do backend; build, lint, clippy e fmt sem erros).

Critério: `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

## Marco — Validação do usuário

Verificações no aplicativo desktop (`npm run tauri -- dev`), com um banco existente:

- [x] O banco existente abre migrado, com todos os textos e pastas.
- [x] Ctrl+clique, Shift+clique e Ctrl+A selecionam vários itens; o painel da seleção move, recorta, copia, favorita, exporta e exclui.
- [x] Ctrl+X/Ctrl+V move; Esc desfaz o recorte; Ctrl+C/Ctrl+V na mesma pasta duplica com " - Cópia"; Ctrl+C num texto permite colá-lo em outro programa.
- [x] Arrastar move para uma pasta e reordena pela linha de inserção; com Ctrl, copia; pasta fechada abre ao parar sobre ela; soltar na Lixeira exclui.
- [x] Ordenar (pasta e raiz), Expandir tudo, Recolher tudo, salto por letras e Enter.
- [x] Del manda para a lixeira com Desfazer; Shift+Del e Esvaziar lixeira confirmam; Restaurar devolve os itens.
- [x] Ctrl+Z desfaz as operações da árvore e não interfere no desfazer dos campos de texto.
- [x] O editor mostra o uso do texto; o menu de colagem mostra Mais usados e Favoritos como pastas.

Resultado: todas as verificações aprovadas pelo usuário em 2026-10-14.
