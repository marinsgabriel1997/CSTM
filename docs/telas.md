# CSTM — Telas

Desenhos aprovados das telas do aplicativo: a referência para implementar. Uma tela nova, ou uma mudança de layout ou de fluxo, é proposta aqui e no protótipo correspondente em `docs/prototipo/` antes da implementação; depois de aprovada, substitui o desenho anterior (o histórico fica no git).

Os desenhos usam somente ASCII (`+`, `-`, `|` e caracteres do teclado), para manter o alinhamento em qualquer editor. Legenda:

| Símbolo | Significado |
| --- | --- |
| `[ Buscar... ]` | campo de texto |
| `[+ Novo v]` | botão com menu |
| `( Favoritos )` | botão de alternância (filtro) |
| `*` | favorito |
| `...` | menu de contexto do item |
| `=>` | item selecionado |
| `v Pasta` / `> Pasta` | pasta aberta / fechada (na árvore) |
| `Pasta  >` | pasta que se abre (no menu de colagem) |
| `<  Pasta` | linha de volta para a pasta acima |
| `(v)` | indicador de salvamento |

## Tela 1 — Cadastro (janela `main`)

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

### Estrutura

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

### Salvamento automático

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
6. Rascunhos inválidos e com erro ficam em memória enquanto o aplicativo estiver aberto; fechar a janela apenas a oculta. Encerrar o aplicativo ("Sair" na bandeja) com pendências pede confirmação.

### Preferências de interface

A largura da árvore e as pastas recolhidas são guardadas no `localStorage` do WebView: não são dados do usuário e ficam fora do SQLite.

## Bandeja e ciclo de vida da janela `main`

O aplicativo fica na bandeja do sistema, com a dica "CSTM".

| Ação | Resultado |
| --- | --- |
| Fechar a janela (X ou Alt+F4) | Oculta a janela e grava as pendências, sem confirmação; os rascunhos que não puderem ser gravados ficam em memória |
| Clique esquerdo no ícone | Abre o cadastro: restaura, mostra e foca a janela |
| Clique direito no ícone | Menu: **Abrir cadastro**, **Configurações**, separador, **Sair** |
| Configurações | Mostra a janela de cadastro e abre o diálogo de configurações |
| Sair | Grava as pendências e encerra; se algo não puder ser gravado, mostra a janela e pede confirmação ("Sair sem salvar?") |
| Executar o aplicativo de novo | Não cria outra instância; traz a janela existente |

A janela abre visível ao iniciar o aplicativo. Não há aviso de que o aplicativo continua na bandeja ao fechar a janela.

## Tela 2 — Menu de colagem (janela `picker`)

Protótipo visual navegável: [`docs/prototipo/picker.html`](prototipo/picker.html) (abre direto no navegador; estados e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

Raiz (estado ao abrir):

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
| FAVORITOS                            |
| => Assinatura                        |
|    Saudação formal                   |
|    Telefone                          |
| TODOS                                |
|    Trabalho                        > |
|    Pessoal                         > |
|    Telefone                          |
|    Link da agenda                    |
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

Dentro de uma pasta:

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
| <  Trabalho > E-mails                |
| => Clientes                        > |
|    Resposta padrão                   |
|    Follow-up                         |
+--------------------------------------+
| Enter colar  < voltar     Esc fechar |
+--------------------------------------+
```

Busca:

```text
+--------------------------------------+
| [ resp                             ] |
+--------------------------------------+
| => Resposta padrão           E-mails |
|    Respostas rápidas         Pessoal |
+--------------------------------------+
| Enter colar               Esc fechar |
+--------------------------------------+
```

### Estrutura

- Abre pelo atalho global `Alt+Q` junto ao cursor do mouse, inteiramente dentro da área útil do monitor em que o cursor está.
- Janela de 340 × 440, sem bordas e sem barra de título, com cantos arredondados e sombra; sempre no topo e fora da barra de tarefas. Segue o tema claro ou escuro do sistema, como o cadastro.
- Campo de busca no topo, com foco automático, lista no meio (com rolagem) e uma linha de dicas de teclado no rodapé.
- Na raiz: a seção **Favoritos** (por título, oculta quando não há favoritos) e a seção **Todos**, com as pastas e depois os textos da raiz, cada grupo na ordem manual do cadastro. Um texto favorito aparece nas duas seções.
- Dentro de uma pasta: uma linha de volta com o caminho (`<  Trabalho > E-mails`) seguida das subpastas e dos textos da pasta, nessa ordem e na ordem manual de cada grupo.
- Pastas têm `>` à direita. Textos mostram só o título; o conteúdo aparece como dica (tooltip) ao passar o mouse.
- Com texto na busca, a lista é substituída pelos resultados (na ordem de relevância do backend), cada um com o nome da pasta em que está à direita, em cinza (o caminho completo fica na dica); textos da raiz não mostram pasta. A busca vale para toda a biblioteca, mesmo aberta dentro de uma pasta.

### Comportamento

| Ação | Resultado |
| --- | --- |
| `↑` / `↓`; `Home` / `End` com a busca vazia | Move a seleção (o foco fica no campo de busca); a primeira linha selecionável começa selecionada |
| `Enter` ou clique num texto | Fecha o menu e cola o texto (no p50: copia para o clipboard) |
| `Enter`, `→` ou clique numa pasta | Abre a pasta |
| `←` ou `Backspace` com a busca vazia, ou clique na linha de volta | Volta para a pasta acima |
| Digitar | Busca; a seleção volta para o primeiro resultado |
| `Esc`, clique fora ou `Alt+Q` | Fecha o menu sem colar |
| Passar o mouse | Move a seleção para a linha sob o cursor |

- Cada abertura começa na raiz, com a busca vazia, e recarrega os dados (refletindo as edições do cadastro).
- `→` e `←` só navegam pastas quando o cursor do campo de busca não teria para onde ir (busca vazia); com texto na busca, movem o cursor normalmente.

### Estados

| Estado | Exibição |
| --- | --- |
| Biblioteca vazia | "Nenhum texto cadastrado." e o botão "Abrir cadastro" |
| Pasta vazia | "Pasta vazia." abaixo da linha de volta |
| Busca sem resultados | "Nenhum texto encontrado." |
| Falha ao carregar | Mensagem de erro do backend no lugar da lista |

## Tela 3 — Configurações (diálogo na janela `main`)

Protótipo visual navegável: [`docs/prototipo/configuracoes.html`](prototipo/configuracoes.html) (abre direto no navegador; estados e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

Atalho atual:

```text
+------------------------------------------------+
| Configurações                              [X] |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
|                                                |
| [ Alt + Q                        ] [ Alterar ] |
|                                                |
| [ Restaurar padrão (Alt+Q) ]        [ Fechar ] |
+------------------------------------------------+
```

Gravando um novo atalho:

```text
+------------------------------------------------+
| Configurações                              [X] |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
|                                                |
| [ Pressione o novo atalho...    ] [Cancelar]   |
| Esc cancela e mantém o atalho atual.           |
|                                                |
| [ Restaurar padrão (Alt+Q) ]        [ Fechar ] |
+------------------------------------------------+
```

### Estrutura

- Diálogo modal sobre a janela de cadastro, com título "Configurações" e botão de fechar. Por enquanto, tem uma única configuração: o atalho do menu de colagem.
- O atalho aparece como teclas (`Alt` + `Q`) num campo somente leitura, com o botão "Alterar" ao lado.
- "Restaurar padrão (Alt+Q)" fica à esquerda, desabilitado quando o atalho já é o padrão ou durante a gravação; "Fechar" à direita.

### Como abrir

| Origem | Ação |
| --- | --- |
| Barra inferior do cadastro | Botão de engrenagem à direita dos totais |
| Menu da bandeja | Item **Configurações**: mostra a janela e abre o diálogo |
| Aviso de atalho indisponível | Ação **Alterar atalho** |

### Comportamento

| Ação | Resultado |
| --- | --- |
| Alterar | O campo passa a aguardar a combinação ("Pressione o novo atalho…") e o botão vira "Cancelar"; o atalho atual fica suspenso, para poder ser pressionado também |
| Pressionar modificadores | O campo mostra os modificadores pressionados (`Ctrl` + `…`) |
| Combinação válida | Vira o novo atalho imediatamente; aparece "Atalho alterado." |
| Combinação inválida | Mostra a regra ("Use Ctrl ou Alt (com Shift, se quiser) e uma letra, número, F1–F12 ou Espaço.") e continua aguardando |
| `Esc`, "Cancelar", fechar o diálogo ou ocultar a janela | Encerra a gravação e reativa o atalho atual |
| Restaurar padrão | Volta para `Alt+Q` |

Regras das combinações: `Ctrl` ou `Alt` obrigatório, `Shift` opcional, sem `Win`; tecla principal entre letras, números, `F1`–`F12` e `Espaço`. A tecla é a física (independe do layout do teclado).

### Estados

| Estado | Exibição |
| --- | --- |
| Atalho em uso por outro programa | Faixa de erro: "Não foi possível usar Ctrl+Shift+V: outro programa pode estar usando esse atalho. O atalho Alt+Q continua valendo." |
| Combinação com `Ctrl+Alt` | Aceita, com faixa de aviso: "Atalhos com Ctrl+Alt podem bloquear caracteres digitados com AltGr (por exemplo, AltGr+Q digita “/” no teclado ABNT2)." |
| Atalho atual indisponível ao iniciar | O aviso do cadastro informa o atalho configurado e oferece "Alterar atalho" |
