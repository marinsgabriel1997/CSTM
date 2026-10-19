# 089 — Raiz na árvore, criação pelos menus e desinstalador sem apagar dados

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-19
- Concluído em: 2026-10-19

## Objetivo

Deixar claro onde os itens novos são criados e permitir criar na raiz a qualquer momento, com uma pasta virtual **Raiz** na árvore e os comandos de criação nos menus de contexto. Além disso, levar a barra de rolagem do editor para a borda da janela, tirar do desinstalador a opção de apagar os dados e explicar a sigla CSTM no README.

## Contexto

- O destino do **Novo** (e de Colar e Importar) é `targetFolder()` em `App.tsx`: a pasta selecionada, a pasta do texto selecionado ou, sem seleção, a raiz. Não há como desfazer a seleção, então, depois do primeiro clique, não dá mais para criar na raiz sem selecionar um item que esteja nela.
- A árvore (`LibraryTree.tsx`) mostra o Histórico no topo (plano 086), depois as pastas e os textos da raiz, e a Lixeira fixa no fim (`TreePane.tsx`). Pastas recolhidas ficam em `preferences.collapsed` (`src/preferences.ts`).
- O menu de contexto de uma pasta (`ItemMenu.tsx`, ações em `actions.ts`) não tem Novo texto nem Nova pasta. O editor de pasta (`FolderEditor`, `Editors.tsx`) tem "Novo texto aqui" e "Nova subpasta".
- O clique direito no espaço vazio da árvore não faz nada.
- No editor (`Editors.tsx`), título, régua e conteúdo ficam numa coluna de no máximo 820 px (`doc`). Num texto grande, quem rola é a caixa do conteúdo (`content`), com a barra de rolagem na borda dela, ou seja, no meio do painel quando a janela é larga.
- O template do instalador (`src-tauri/windows/installer.nsi`, cópia do template do Tauri CLI) acrescenta à página de confirmação do desinstalador a caixa "apagar os dados do aplicativo", desmarcada por padrão. Marcada, ela remove `%APPDATA%\com.gabriel.cstm` (com o `cstm.db`) e `%LOCALAPPDATA%\com.gabriel.cstm`. Marcá-la sem querer apaga todos os textos.
- O README não diz o que é a sigla. O `shortDescription` do `tauri.conf.json` diz "CSTM - Clipboard, Snippets & Text Manager".

## Escopo

1. **Pasta Raiz:** pasta virtual fixa na árvore, logo abaixo do Histórico e acima de tudo o que hoje está na raiz. As pastas e os textos da raiz passam a aparecer dentro dela, um nível abaixo. Não existe no banco: os itens continuam com `folder_id` nulo.
   - Abre e fecha como uma pasta; começa aberta, e a escolha é lembrada nas preferências. **Expandir tudo** a abre; **Recolher tudo** recolhe as pastas e não mexe nela.
   - Selecionada, é o destino de Novo, Colar e Importar. O menu do Novo mostra "Raiz".
   - Continua visível com a busca ou o filtro de favoritos ativos, com os resultados dentro dela, sempre aberta.
   - Aceita itens soltos sobre ela, que vão para a raiz, no fim do grupo.
   - Não pode ser renomeada, movida, copiada, recortada, favoritada nem excluída, e não entra na seleção múltipla.
   - No editor, aparece como uma pasta com o título fixo "Raiz" (sem edição), a contagem de textos e pastas da raiz, sem a lixeira, e os botões "Novo texto aqui" e "Nova subpasta".
   - Menu de contexto (clique direito e `...`): Novo texto, Nova pasta, Colar, Ordenar (submenu, igual ao Ordenar a raiz) e Exportar (submenu, igual ao Exportar tudo).
   - Teclado: navegável como uma pasta (`→` e `←` abrem e fecham).
2. **Desfazer a seleção:** clicar no espaço vazio da árvore e `Esc` na árvore tiram a seleção, e o destino passa a ser a raiz. Com itens recortados, `Esc` continua desfazendo o recorte primeiro; um segundo `Esc` tira a seleção. Sem seleção, o editor mostra o mesmo que hoje, quando nada está selecionado.
3. **Clique direito no espaço vazio:** menu com Novo texto e Nova pasta, que criam na raiz.
4. **Menu de contexto de pasta:** ganha Novo texto e Nova pasta no topo, que criam dentro daquela pasta. Não aparecem com uma seleção múltipla.
5. **Desinstalador:** sai a caixa de apagar os dados. Desinstalar sempre preserva `%APPDATA%\com.gabriel.cstm` e `%LOCALAPPDATA%\com.gabriel.cstm`, e também as chaves de registro do local de instalação e do idioma, que só eram removidas com a caixa marcada. Para apagar os dados, a Ajuda e o README explicam os meios atuais: excluir e esvaziar a Lixeira, **Limpar histórico**, ou apagar a pasta dos dados depois de desinstalar.
6. **README:** explica a sigla, "Clipboard, Snippets & Text Manager", logo abaixo do título.
7. **Rolagem do editor:** num texto grande, a barra de rolagem do conteúdo fica na borda direita do painel do editor, e não no meio. O título e a régua ficam parados no topo, e só o conteúdo rola. O texto continua com no máximo 820 px de largura, na mesma posição de hoje. Vale para os textos do cadastro e para os itens de texto do Histórico, que usam a mesma coluna e a mesma caixa (`doc` e `content`); no Histórico, a data, o aviso de formatação e a régua ficam parados. As imagens do Histórico já se ajustam ao painel e não mudam.

Fora do escopo: botão "Apagar todos os dados" no aplicativo, Raiz no menu de colagem, mudança no destino padrão do Novo sem seleção (continua a raiz), pasta raiz real no banco.

## Estado desejado (técnico)

- Frontend:
  - `LibraryTree.tsx`: linha da Raiz, recuo dos itens da raiz e alvo de soltar.
  - `App.tsx`: seleção da Raiz e seleção vazia, `targetFolder()`, `Esc` e clique no vazio.
  - `TreePane.tsx`: menu do espaço vazio.
  - `ItemMenu.tsx` e `actions.ts`: Novo nos menus de pasta e da Raiz.
  - `Editors.tsx`: `FolderEditor` sem renomear para a Raiz.
  - `preferences.ts`: Raiz recolhida, com leitura tolerante, e o padrão aberto.
  - `Editors.tsx`, rolagem: a caixa do conteúdo ocupa a largura toda do painel. Um recuo interno à direita (do tipo `max(28px, 100% - 820px + 28px)`) mantém o texto na coluna de 820 px, e o título e a régua continuam na coluna, sem rolar.
- A seleção ganha uma referência própria para a Raiz, sem id de banco (como o Histórico). As ações de árvore recusam a Raiz como item.
- Backend: nenhuma mudança de comando ou de banco; Novo, Colar, Importar, Ordenar e Exportar na raiz usam os comandos atuais com pasta nula.
- `src-tauri/windows/installer.nsi`: sem `un.ConfirmShow`, `un.ConfirmLeave`, as variáveis da caixa e o bloco que apaga os dados.

## Riscos

- **Recuo e navegação:** um nível a mais em todos os itens muda a largura útil da árvore e a navegação por teclado (primeiro item, `Home`, `←` num item da raiz, que passa a ir para a Raiz). Os testes da árvore precisam cobrir isso; expectativas que dependem do recuo só mudam se o comportamento pedido mudar.
- **Arrastar:** hoje, soltar entre itens da raiz reordena. Soltar sobre a Raiz move para o fim do grupo, sem conflitar com a reordenação.
- **Template do instalador:** a mudança se soma às do CSTM já listadas em `docs/produto.md`, que precisam ser reaplicadas ao atualizar o Tauri CLI.
- **Rolagem do editor:** a caixa mais larga não pode mudar onde o texto quebra a linha, nem a posição do texto com a janela estreita (mínimo de 760 px) ou com a árvore redimensionada. Conferir nos dois casos e com o aviso de texto longo (`hint`) visível.
- **Dados que ficam após desinstalar:** o WebView2 deixa `%LOCALAPPDATA%\com.gabriel.cstm` (cache). É aceitável e fica documentado.

## Premissas

- Versão da entrega: 0.20.0 (MINOR, funcionalidades compatíveis), publicada depois da 0.19.1 (plano 088). Essa publicação é a que permite a segunda etapa do Marco do plano 088.
- O nome fixo é "Raiz", com o ícone de pasta.

## Estratégia de validação

- Frontend: `npm run test`, com testes novos em `App.test.tsx` ou nos testes da árvore para:
  - a Raiz: destino do Novo, soltar, recolher e lembrar, busca, editor, menu;
  - desfazer a seleção por clique no vazio e por `Esc`;
  - o menu do espaço vazio e o Novo no menu de pasta.
  Também `npm run build` e `npm run lint`.
- `src/test/fakeApi.ts` sem mudança de contrato.
- Instalador: build de teste `0.20.0-teste-089`, desinstalação no Marco.

## Fase 0 — Desenho

- [x] `docs/telas.md`, Tela 1:
  - Raiz na árvore, na tabela e nos diagramas;
  - Criação (destino e seleção vazia);
  - menu de contexto da pasta e da Raiz;
  - menu do espaço vazio;
  - Esc e clique no vazio em Operações da árvore;
  - a rolagem do conteúdo no editor, com a barra na borda e o título parado.
- [x] `docs/prototipo/cadastro.html` com a Raiz, os menus novos e a rolagem do editor.

Critério: desenho registrado e coerente com o escopo.

## Fase 1 — Raiz e seleção

- [x] Linha da Raiz, recuo, recolher e lembrar, visível na busca, navegação por teclado.
- [x] Seleção da Raiz como destino e editor da Raiz; seleção vazia por clique no vazio e `Esc`.
- [x] Soltar sobre a Raiz move para a raiz; a Raiz não é arrastável nem entra na seleção múltipla.
- [x] Testes.

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

Resultado: `ROOT_FOLDER` (`{ kind: "folder", id: 0 }`) em `actions.ts`, linha da Raiz em `LibraryTree.tsx`, `rootCollapsed` nas preferências, `RootEditor` em `Editors.tsx`; testes novos em `src/Root.test.tsx`. Nos testes existentes, o auxiliar `treeRows()` passou a omitir a linha da Raiz e o nível que ela acrescenta, e três testes de teclado ganharam uma tecla de seta a mais, porque a Raiz fica entre os itens.

## Fase 2 — Menus

- [x] Menu de contexto da Raiz (Novo texto, Nova pasta, Colar, Ordenar, Exportar).
- [x] Novo texto e Nova pasta no menu de contexto de pasta.
- [x] Menu do clique direito no espaço vazio (Novo texto, Nova pasta, na raiz).
- [x] Testes.

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

Resultado: chaves `newSnippet` e `newFolder` em `ActionKey`; menu da Raiz em `actionsFor`/`runRootAction` (`App.tsx`); menu do espaço vazio em `LibraryTree.tsx`.

## Fase 3 — Rolagem do editor

- [x] Caixa do conteúdo na largura do painel, texto na coluna de 820 px, título e régua parados.

Critério: `npm run test`, `npm run build` e `npm run lint` passando.

Resultado: no `SnippetEditor` e no texto do `ClipEditor`, a coluna `doc` perde o limite de largura e o recuo direito; título, uso, avisos e régua ficam limitados a 764 px; o `textarea` ocupa a largura do painel com recuo direito `max(28px, calc(100% - 764px))`, mantendo a largura do texto. O editor da Raiz conta "pastas" (não "subpastas"). Layout não verificável no jsdom: fica para o Marco.

## Fase 4 — Desinstalador

- [x] Caixa e bloco de apagar dados removidos de `installer.nsi`.

Critério: `npm run tauri -- build --config '{"version":"0.20.0-teste-089"}'` gera o instalador sem erro.

Resultado: instalador `CSTM_0.20.0-teste-089_x64-setup.exe` gerado sem erro e copiado para `releases/teste/` como `CSTM_0.20.0-teste-089-20261019-1345_x64-setup.exe`.

## Fase 5 — Documentação

- [x] `docs/produto.md`:
  - os dados sempre preservados ao desinstalar;
  - a lista de mudanças do template;
  - a Raiz na árvore.
- [x] `README.md`: a sigla abaixo do título; Desinstalar sem a opção, com onde ficam os dados para quem quiser apagá-los.
- [x] `src/helpContent.ts`:
  - a Raiz e onde os itens novos são criados;
  - desfazer a seleção;
  - os menus novos;
  - como apagar os dados.
- [x] `CHANGELOG.md` (`Added`; `Changed` para o desinstalador e o README; `Fixed` para a rolagem do editor).

Critério: documentação revisada e coerente com o código.

## Fase 6 — Barras de rolagem (ajuste do Marco)

- [x] Protótipo: barras finas, sem setas, polegar arredondado no tom do tema, sem faixa de fundo (aprovado pelo usuário).
- [x] `src/App.css`: o mesmo estilo em `::-webkit-scrollbar*` para as duas janelas, com a cor do polegar derivada de `--colorNeutralForeground1` (28%, 45% ao passar o mouse).
- [x] `docs/telas.md` (linha "Barras de rolagem") e `CHANGELOG.md` (`Changed`).
- [x] Novo build de teste: `releases/teste/CSTM_0.20.0-teste-089-20261019-1357_x64-setup.exe`.

Critério: `npm run test`, `npm run build`, `npm run lint` e o build de teste passando.

## Marco — Validação do usuário

- [x] A Raiz aparece abaixo do Histórico, com tudo dentro; recolhe e continua recolhida ao reiniciar; continua visível na busca.
- [x] Com a Raiz selecionada, Novo cria texto e pasta na raiz; o editor mostra "Raiz" sem renomear, com as contagens e os dois botões.
- [x] Soltar um item sobre a Raiz o tira da pasta; a Raiz não pode ser arrastada, renomeada nem excluída.
- [x] Clique no espaço vazio e `Esc` tiram a seleção; Novo passa a criar na raiz.
- [x] Clique direito no espaço vazio: Novo texto e Nova pasta criam na raiz.
- [x] Menu de contexto de uma pasta: Novo texto e Nova pasta criam dentro dela. Menu da Raiz: Novo, Colar, Ordenar e Exportar funcionam.
- [x] Texto grande, com a janela maximizada e na largura mínima: a barra de rolagem fica na borda direita, o título fica parado e o texto continua na mesma largura de antes. O mesmo com um item de texto do Histórico.
- [x] A Ajuda descreve a Raiz, os menus novos e como apagar os dados.
- [x] Build `0.20.0-teste-089` instalado e desinstalado: a confirmação não tem a caixa de apagar dados, e o `cstm.db` continua em `%APPDATA%\com.gabriel.cstm`. Reinstalar mostra os textos de antes.
- [x] README explica a sigla.
- [x] Barras de rolagem finas e discretas na árvore, no editor, na Lixeira e no menu de colagem, nos dois temas.

Resultados:

- Todas as verificações aprovadas pelo usuário no build de teste.
- Validação técnica: `npm run test` (15 arquivos, 269 testes), `npm run build` e `npm run lint` passando; build de teste gerado. Não verificado pelo agente: o layout da rolagem e o desinstalador no Windows.
- Ajuste pedido no Marco: a barra de rolagem padrão estava feia. Estilizada no protótipo, aprovada e aplicada ao aplicativo (Fase 6).

Aceite: aprovado pelo usuário em 2026-10-19 ("tudo certo"), com o build `0.20.0-teste-089` de 13:57.
