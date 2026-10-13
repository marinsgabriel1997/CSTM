# CSTM — Telas

Wireframes das telas do aplicativo, desenhados antes da implementação. Cada tela tem um inventário do que precisa existir (derivado de `docs/mvp.md`) e versões numeradas do desenho. A versão marcada como **aprovada** é a referência para implementar; as demais ficam como histórico.

Os desenhos usam somente ASCII (`+`, `-`, `|` e caracteres do teclado), para manter o alinhamento em qualquer editor. Legenda:

| Símbolo | Significado |
| --- | --- |
| `[ Texto ]` | botão |
| `[R]` `[X]` `[^]` `[v]` | botão de ícone: renomear, excluir, subir, descer |
| `[_____]` | campo de texto |
| `[ Opção v ]` | seletor |
| `*` / `( )` | favorito marcado / desmarcado |
| `=>` | item selecionado |
| `v Pasta` / `> Pasta` | pasta aberta / fechada (na árvore) |

## Tela 1 — Cadastro (janela `main`)

### Inventário

O que a tela precisa permitir, independentemente do desenho:

- **Navegar:** favoritos, textos sem pasta, árvore de pastas com subpastas.
- **Buscar:** por título e conteúdo, em todas as pastas.
- **Pastas:** criar (na raiz ou dentro de outra), renomear, excluir (com confirmação; leva subpastas e textos), reordenar, mover para outra pasta.
- **Textos:** criar, editar título e conteúdo, salvar, excluir (com confirmação), favoritar, reordenar dentro da pasta, mover para outra pasta.
- **Proteções:** avisar antes de descartar alterações não salvas; título e conteúdo obrigatórios.
- **Feedback:** mensagens de erro do backend.

Estados a desenhar:

1. Primeiro uso (nenhuma pasta, nenhum texto).
2. Pasta com textos, nenhum texto aberto.
3. Texto aberto para edição.
4. Novo texto (rascunho ainda não salvo).
5. Resultado de busca.
6. Confirmação (excluir, descartar alterações).
7. Erro.

### v0 — implementação atual (não aprovada)

Três colunas fixas: navegação, lista de títulos e editor em formulário.

```text
+----------------------------------------------------------------------------------------+
| CSTM                                                                                   |
+------------------------+--------------------------------+------------------------------+
| [ Buscar textos     ]  | Sem pasta     [ Novo texto ]   | ( ) Novo texto   [ Salvar ]  |
|                        |                                |                              |
|    Favoritos           | * Saudação formal              | Pasta                        |
| => Sem pasta           |   Assinatura                   | [ Sem pasta            v ]   |
|                        |   Endereço                     | Título                       |
| Pastas            [+]  |                                | [________________________]   |
| v Trabalho             |                                | Conteúdo                     |
|     E-mails            |                                | [                        ]   |
|   Pessoal              |                                | [                        ]   |
|                        |                                | [                        ]   |
| [R] [X] [^] [v]        |                                |                              |
| Mover para [Raiz  v]   |                                |                              |
+------------------------+--------------------------------+------------------------------+
```

Problemas observados:

- Três faixas verticais de cinzas diferentes, com cara de painel administrativo.
- Metade da janela fica vazia quando nenhum texto está aberto.
- A lista mostra só o título; o conteúdo não aparece.
- O editor parece um formulário de cadastro (rótulos e caixas), não um editor de texto.
- Ações de pasta no rodapé da barra lateral, longe da pasta.

### Conceitos v1 — arquiteturas alternativas (C escolhido)

Três propostas que diferem em navegação, distribuição do espaço e fluxo de edição. A escolha é do conceito; cores, fontes e componentes vêm depois.

| | A — Busca primeiro | B — Explorador | C — Árvore + editor |
| --- | --- | --- | --- |
| Navegação | busca e trilha de pastas, sem barra lateral | entrar e sair de pastas, com botão Voltar | uma árvore única com pastas e textos |
| Espaço | uma coluna na largura toda | grade de cartões; editor ocupa a janela | duas colunas fixas: árvore e editor |
| Edição | o texto se expande na própria lista | tela própria de edição | editor sempre visível, salvamento automático |

#### A — Busca primeiro

Uma coluna só, como o menu de colagem: a busca no topo é o ponto de entrada. A trilha (`Todas > Trabalho`) mostra onde se está; clicar numa subpasta entra nela, clicar num nível da trilha volta. A lista mostra título e início do conteúdo; dentro de uma pasta aparecem primeiro os favoritos dela, depois os textos e as subpastas. Ações de pasta (criar, renomear, excluir, mover) ficam no menu `[ Pastas v ]` da pasta atual.

Lista na pasta Trabalho:

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+--------------------------------------------------------------------------------+
|                                                                                |
|  [ Buscar em todos os textos...                           ]   [ + Novo texto ] |
|  Todas > Trabalho                                            [ Pastas v ]      |
|                                                                                |
|  FAVORITOS                                                                     |
|  * Saudação formal     Prezado(a), espero que esteja bem...      Trabalho      |
|  * Assinatura          Atenciosamente, Gabriel de Marins         Sem pasta     |
|                                                                                |
|  TRABALHO                                                                      |
|    Resposta padrão     Obrigado pelo contato, retornaremos...                  |
|    Follow-up           Olá, passando para saber se...                          |
|                                                                                |
|  SUBPASTAS                                                                     |
|    E-mails  (4)                                                        >       |
|    Clientes (2)                                                        >       |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Edição: clicar num texto o expande no lugar, empurrando os demais para baixo. `Salvar` e `Cancelar` fecham o cartão.

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+--------------------------------------------------------------------------------+
|                                                                                |
|  [ Buscar em todos os textos...                           ]   [ + Novo texto ] |
|  Todas > Trabalho                                            [ Pastas v ]      |
|                                                                                |
|  TRABALHO                                                                      |
|  +--------------------------------------------------------------------------+  |
|  | ( )  [ Resposta padrão_____________ ]          [ Pasta: Trabalho v ]     |  |
|  |                                                                          |  |
|  | [ Obrigado pelo contato, retornaremos em até 24h.                 ]      |  |
|  | [                                                                 ]      |  |
|  | [                                                                 ]      |  |
|  |                                                                          |  |
|  |                       [ Excluir ]   [ Cancelar ]   [ Salvar ]            |  |
|  +--------------------------------------------------------------------------+  |
|    Follow-up           Olá, passando para saber se...                          |
|                                                                                |
+--------------------------------------------------------------------------------+
```

- **Prós:** busca sempre à mão; mesma lógica visual do menu de colagem; funciona bem em janela estreita; lista com prévia do conteúdo.
- **Contras:** textos longos ficam desconfortáveis no cartão expandido; a árvore de pastas não fica visível de uma vez; reorganizar muitas pastas exige entrar em cada uma.

#### B — Explorador

Metáfora do Explorador de Arquivos: a janela mostra o conteúdo de uma pasta por vez, com pastas e textos como cartões (pastas primeiro). Duplo clique numa pasta entra nela; `[<]` volta. Na raiz (`Início`) aparecem um cartão "Favoritos", as pastas e os textos sem pasta. Renomear, excluir e mover ficam no menu de contexto (botão direito) de cada cartão.

Pasta Trabalho:

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+--------------------------------------------------------------------------------+
|                                                                                |
|  [<]  Início > Trabalho                  [ Buscar... ]  [+ Pasta] [+ Texto]    |
|  ----------------------------------------------------------------------------  |
|                                                                                |
|  +----------------------+  +----------------------+  +----------------------+  |
|  | PASTA                |  | PASTA                |  | * Saudação formal    |  |
|  | E-mails              |  | Clientes             |  | Prezado(a),          |  |
|  | 4 textos             |  | 2 textos             |  | espero que...        |  |
|  +----------------------+  +----------------------+  +----------------------+  |
|                                                                                |
|  +----------------------+  +----------------------+                            |
|  | Resposta padrão      |  | Follow-up            |                            |
|  | Obrigado pelo        |  | Olá, passando        |                            |
|  | contato...           |  | para saber...        |                            |
|  +----------------------+  +----------------------+                            |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Edição: abrir um texto troca a janela inteira pelo editor, como um documento; `[<]` volta à pasta (pedindo confirmação se houver alterações não salvas).

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+--------------------------------------------------------------------------------+
|                                                                                |
|  [<]  Trabalho > Saudação formal                ( )   [ Excluir ]  [ Salvar ]  |
|  ----------------------------------------------------------------------------  |
|                                                                                |
|     Saudação formal                                                            |
|     ------------------------------------------------------------------         |
|     Prezado(a),                                                                |
|                                                                                |
|     Espero que esteja bem.                                                     |
|                                                                                |
|                                                                                |
|                                                                                |
|                                      Pasta: [ Trabalho v ]                     |
|                                                                                |
+--------------------------------------------------------------------------------+
```

- **Prós:** familiar para quem usa o Windows; editor com espaço total, bom para textos longos; cartões mostram prévia; organização de pastas e textos no mesmo lugar.
- **Contras:** só se vê uma pasta por vez; editar vários textos em sequência exige ir e voltar; ações em menu de contexto ficam menos visíveis.

#### C — Árvore única + editor sempre aberto (escolhido)

Duas colunas fixas: à esquerda uma árvore única em que pastas e textos convivem (textos são folhas; textos sem pasta ficam na raiz da árvore); à direita o editor do texto selecionado. Não há coluna de lista separada nem entradas "Favoritos" e "Sem pasta": favoritos viram um filtro (`[ Só favoritos ]`) que reduz a árvore. Criar pasta (`[+P]`) e texto (`[+T]`) usa a posição selecionada na árvore.

Edição com salvamento automático: não há botão Salvar; alterações válidas são gravadas após uma pausa na digitação, e o rodapé mostra o estado.

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+-------------------------------+------------------------------------------------+
| [ Buscar...                 ] |  Trabalho / E-mails                       ( )  |
| [ Só favoritos ]  [+P]  [+T]  |                                                |
+-------------------------------+------------------------------------------------+
| v Trabalho                    |  Resposta padrão                               |
|   v E-mails                   |  ------------------------------------------    |
|     => Resposta padrão        |  Obrigado pelo contato, retornaremos em        |
|        Follow-up              |  até 24h.                                      |
|   > Clientes                  |                                                |
|   * Saudação formal           |                                                |
| > Pessoal                     |                                                |
|   Assinatura                  |                                                |
|   Endereço                    |                                                |
|                               |                    Salvo automaticamente 14:02 |
+-------------------------------+------------------------------------------------+
```

- **Prós:** estrutura inteira visível de uma vez; trocar de texto é um clique; sem "Salvar" nem aviso de descarte; menos elementos na tela.
- **Contras:** árvore fica longa com muitos textos; título não fica destacado na árvore além do nome; salvamento automático muda o fluxo aprovado no p30 (botão Salvar e aviso de descarte) e precisa de regra para título ou conteúdo vazios (não grava até ficarem válidos).

### v2 — conceito C refinado (aprovado)

Protótipo visual navegável: [`docs/prototipo/cadastro.html`](prototipo/cadastro.html) (abre direto no navegador; estados e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+-------------------------------+------------------------------------------------+
| [ Buscar...      ] [+ Novo v] |  Trabalho > E-mails                    *  ...  |
| ( Favoritos )                 |                                                |
|                               |  Resposta padrão                               |
| v Trabalho                    |  --------------------------------------------  |
|   v E-mails                   |  Olá!                                          |
| =>  Resposta padrão       ... |                                                |
|     Follow-up                 |  Obrigado pelo contato. Recebemos sua          |
|   > Clientes                  |  mensagem e retornaremos em até 24 horas.      |
|   Saudação formal          *  |                                                |
|   Assinatura               *  |  Atenciosamente,                               |
| > Pessoal                     |  Gabriel                                       |
| Telefone                   *  |                                                |
| Link da agenda                |                                                |
+-------------------------------+------------------------------------------------+
| (v) Todas as alterações salvas                             9 textos · 4 pastas |
+--------------------------------------------------------------------------------+
```

Legenda adicional: `( Favoritos )` é o filtro de favoritos; `...` abre o menu de contexto do item; `(v)` é o indicador de salvamento.

#### Estrutura

| Elemento | Decisão |
| --- | --- |
| Árvore | Única, com pastas e textos. Pastas primeiro, depois textos, cada grupo na sua ordem manual. Textos sem pasta ficam na raiz. Ícones distintos para pasta (aberta/fechada) e texto; estrela à direita dos favoritos. |
| Seleção | Item selecionado com fundo e marca de destaque à esquerda. Clicar na seta abre/fecha a pasta; clicar no item o seleciona. |
| Menu de contexto | Botão `...` (visível ao passar o mouse e no item selecionado) ou clique direito: Renomear (F2), Mover para… (Ctrl+M), Mover para cima (Alt+↑), Mover para baixo (Alt+↓), Adicionar/Remover dos favoritos (só textos), Excluir (Del). |
| Criação | Botão único `+ Novo` com menu: Novo texto (Ctrl+N) e Nova pasta (Ctrl+Shift+N). O destino é a pasta selecionada, ou a pasta do texto selecionado, ou a raiz; o menu informa o destino. Itens novos entram no fim do grupo. |
| Nova pasta | Entra na árvore com o nome em edição; Enter grava, Esc cancela. |
| Editor de texto | Caminho da pasta no topo (cada parte seleciona a pasta na árvore), estrela e `...` à direita. Título grande editável direto, linha fina, conteúdo editável direto. Sem rótulos nem caixas. |
| Editor de pasta | Selecionar uma pasta mostra o nome como título (renomear editando), a contagem de textos e subpastas e os atalhos "Novo texto aqui" e "Nova subpasta". |
| Favoritos | Estrela na árvore e no editor; filtro `Favoritos` reduz a árvore aos textos marcados, mantendo as pastas onde estão. |
| Busca | Filtra a própria árvore: mantém as pastas que contêm resultados (abertas) e destaca o termo. Quando a correspondência é só no conteúdo, o item mostra um trecho. Contagem de resultados ao lado do filtro. Limpar a busca restaura a árvore. |
| Divisor | Entre árvore e editor, arrastável entre 220 e 480 px. |
| Barra inferior | Estado do salvamento à esquerda; totais de textos e pastas à direita. |
| Primeiro uso | Árvore com chamada para criar texto ou pasta; editor com apresentação do aplicativo em três passos. |
| Confirmação | Diálogo modal para excluir, informando o que vai junto (subpastas, textos, favoritos). Excluir em vermelho. |

#### Salvamento automático

Estados exibidos na barra inferior (e, quando relevante, no item da árvore):

| Estado | Quando | Barra inferior | Árvore |
| --- | --- | --- | --- |
| Salvo | nada pendente | "Todas as alterações salvas" | — |
| Pendente | alteração feita, aguardando pausa | "Alterações pendentes" | ponto cinza |
| Salvando | gravação em andamento | indicador + "Salvando…" | ponto cinza |
| Rascunho | texto novo ainda incompleto | "Rascunho: preencha o título e o conteúdo para salvar" | nome em itálico |
| Inválido | título ou conteúdo vazio num texto já salvo | aviso: não salvo, última versão mantida | ponto amarelo |
| Erro | falha do backend | erro com a mensagem e "Tentar novamente"; faixa de erro no editor | ponto vermelho |

Regras:

1. Gravação após 800 ms sem digitar, ao trocar de item, quando a janela perde o foco e em Ctrl+S (gravar agora).
2. Só grava conteúdo válido (título e conteúdo não vazios após remover espaços das bordas, regra do p20). Rascunho novo é criado no banco na primeira gravação válida; depois disso, as gravações atualizam o mesmo texto.
3. Rascunho inválido é preservado: o texto digitado continua no editor e o item fica marcado na árvore, mesmo trocando de item. O banco mantém a última versão válida. Rascunho novo sem nada digitado é descartado ao sair dele.
4. Erro não descarta nada: o conteúdo fica no editor, o item é marcado e a gravação é tentada de novo pelo botão ou na próxima edição.
5. Uma gravação por texto de cada vez; edições feitas durante a gravação disparam outra ao terminar.
6. Rascunhos inválidos e com erro ficam em memória enquanto o aplicativo estiver aberto (com o p40, fechar a janela apenas a oculta). Encerrar o aplicativo com pendências pede confirmação.

#### Impactos funcionais

O conceito C altera requisitos aprovados anteriormente no p30; as mudanças entram no plano `planos/p30-tela-de-cadastro.md` (fase 7).

Requisitos do p30 que mudam:

| Hoje no p30 | Passa a ser |
| --- | --- |
| Layout em três colunas (barra lateral, lista, editor) | Duas colunas: árvore única e editor, com divisor redimensionável |
| Entradas fixas "Favoritos" e "Sem pasta" | Favoritos viram filtro; textos sem pasta ficam na raiz da árvore |
| Botão Salvar e `Ctrl+S` para gravar | Salvamento automático; `Ctrl+S` só antecipa a gravação |
| Rascunho gravado só ao salvar | Rascunho gravado automaticamente quando ficar válido |
| Confirmação para descartar alterações não salvas | Removida: nada é descartado; rascunhos inválidos ficam preservados e marcados |
| Botões ↑/↓ e seletor "Mover para" na tela | Menu de contexto com mover para cima/baixo, Mover para… (diálogo) e atalhos |
| Busca mostra lista de resultados por relevância | Busca filtra a árvore, preservando a hierarquia; a ordem é a da árvore (relevância segue disponível para o menu de colagem) |
| Renomear pasta por formulário na barra lateral | Renomear na árvore (F2) ou pelo título no editor de pasta |
| Erros em faixa no topo da janela | Erros de gravação na barra inferior e no editor; demais erros em faixa |

Mudanças técnicas decorrentes:

- **Backend:** novo comando para listar todos os textos de uma vez (a árvore precisa deles), com função no `db` e teste. Sem mudança de esquema nem das regras do p20.
- **Frontend:** reescrever a tela (árvore, menus, editor, barra inferior) e a lógica de edição (estados de salvamento, fila de gravação por texto, rascunhos em memória). Continua com Fluent UI (Tree, Menu, Dialog, tokens) ajustado ao visual do protótipo.
- **Preferências de interface:** largura da árvore e pastas recolhidas guardadas no `localStorage` do WebView (não são dados do usuário e ficam fora do SQLite).
- **Testes:** substituir os testes de salvar e de descarte por testes de salvamento automático (com relógio simulado), rascunho inválido preservado, erro com nova tentativa, árvore mista, menu de contexto, busca preservando hierarquia e filtro de favoritos.
- **Documentação:** atualizar o plano p30 (escopo, riscos, nova fase), `CHANGELOG.md` e `AGENTS.md` (referência a este documento e ao protótipo).

Decisões tomadas na aprovação:

1. Rascunhos inválidos ficam só em memória, sem persistência entre execuções.
2. Pausa de 800 ms antes de gravar.
3. Largura da árvore e pastas recolhidas no `localStorage`.
4. Encerrar o aplicativo com pendências pede confirmação.

## Tela 2 — Menu de colagem (janela `picker`)

A desenhar no planejamento do p50. Inventário inicial, de `docs/mvp.md`: favoritos, pastas navegáveis, campo de busca com foco automático, navegação por teclado (setas, Enter, Esc) e mouse; abre junto ao cursor, fecha ao colar, com `Esc` ou clique fora.
