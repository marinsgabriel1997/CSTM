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
| [ Buscar... ] [+ Novo v] [...]|  Trabalho > E-mails                    *  ...  |
| ( Favoritos )                 |                                                |
|                               |  Resposta padrão                               |
| v Trabalho                    |  Usado 12 vezes · último uso em 10/10/2026     |
|   v E-mails                   |  --------------------------------------------  |
| =>  Resposta padrão       ... |  Olá!                                          |
|     Follow-up                 |                                                |
|   > Clientes                  |  Obrigado pelo contato. Recebemos sua          |
|   Saudação formal          *  |  mensagem e retornaremos em até 24 horas.      |
|   Assinatura               *  |                                                |
| > Pessoal                     |  Atenciosamente,                               |
| Telefone                   *  |  Gabriel                                       |
| Link da agenda                |                                                |
|-------------------------------|                                                |
| Lixeira                     3 |                                                |
+-------------------------------+------------------------------------------------+
| (v) Todas as alterações salvas                             9 textos · 4 pastas |
+--------------------------------------------------------------------------------+
```

### Estrutura

| Elemento | Decisão |
| --- | --- |
| Árvore | Única, com pastas e textos. Pastas primeiro, depois textos, cada grupo na sua ordem manual. Textos sem pasta ficam na raiz. Ícones distintos para pasta (aberta/fechada) e texto; estrela à direita dos favoritos. A Lixeira fica fixa no fim, fora da rolagem, com a contagem de itens. |
| Seleção | Item selecionado com fundo e marca de destaque à esquerda. Clicar na seta abre/fecha a pasta; clicar no item o seleciona. Ctrl+clique, Shift+clique e Ctrl+A selecionam vários (ver Operações da árvore). |
| Menu de contexto | Botão `...` (visível ao passar o mouse e no item selecionado) ou clique direito: Recortar (Ctrl+X), Copiar (Ctrl+C), Colar (Ctrl+V), Renomear (F2), Mover para…, Mover para cima, Mover para baixo, Adicionar/Remover dos favoritos (só textos), Ordenar (só pastas; submenu), Exportar (só pastas; submenu, ver Importação e exportação), Excluir (Del). Sobre uma seleção múltipla, ver Operações da árvore. |
| Criação | Botão único `+ Novo` com menu: Novo texto (Ctrl+N) e Nova pasta (Ctrl+Shift+N). O destino é a pasta selecionada, ou a pasta do texto selecionado, ou a raiz; o menu informa o destino. Itens novos entram no fim do grupo. |
| Botão `...` | Ao lado do `+ Novo` (rótulo acessível "Mais opções"): submenus Importar e Exportar tudo (ver Importação e exportação), Ordenar a raiz, Expandir tudo e Recolher tudo. |
| Nova pasta | Entra na árvore com o nome em edição; Enter grava, Esc cancela. |
| Editor de texto | Caminho da pasta no topo (cada parte seleciona a pasta na árvore), estrela e `...` à direita. Título grande editável direto; abaixo dele, em cinza, "Usado 12 vezes · último uso em 10/10/2026" ou "Ainda não usado"; linha fina, conteúdo editável direto. Sem rótulos nem caixas. |
| Editor de pasta | Selecionar uma pasta mostra o nome como título (renomear editando), a contagem de textos e subpastas e os atalhos "Novo texto aqui" e "Nova subpasta". |
| Favoritos | Estrela na árvore e no editor; filtro `Favoritos` reduz a árvore aos textos marcados, mantendo as pastas onde estão. |
| Busca | Filtra a própria árvore: mantém as pastas que contêm resultados (abertas) e destaca o termo. Quando a correspondência é só no conteúdo, o item mostra um trecho. Contagem de resultados ao lado do filtro. Limpar a busca restaura a árvore. |
| Divisor | Entre árvore e editor, arrastável entre 220 e 480 px. |
| Barra inferior | Estado do salvamento à esquerda; totais de textos e pastas à direita, sem contar a lixeira. |
| Primeiro uso | Árvore com chamada para criar texto ou pasta; editor com apresentação do aplicativo em três passos. |
| Confirmação | Diálogo modal somente para o que não tem volta: excluir definitivamente e esvaziar a lixeira, informando o que vai junto (subpastas, textos, favoritos). Botão de confirmar em vermelho. Excluir comum vai para a lixeira, sem diálogo. |

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

### Operações da árvore

Seleção múltipla (Ctrl+clique em Resposta padrão, Follow-up e Assinatura):

```text
+-------------------------------+------------------------------------------------+
| [ Buscar... ] [+ Novo v] [...]|  Seleção                                       |
| ( Favoritos )                 |                                                |
|                               |  3 itens selecionados                          |
| v Trabalho                    |  3 textos                                      |
|   v E-mails                   |                                                |
| =>  Resposta padrão           |  [Mover para...] [Recortar] [Copiar]           |
| =>  Follow-up                 |  [Adicionar aos favoritos] [Exportar v]        |
|   > Clientes                  |  [Excluir]                                     |
|   Saudação formal          *  |  --------------------------------------------  |
| =>Assinatura               *  |  Resposta padrão           Trabalho > E-mails  |
| > Pessoal                     |  Follow-up                 Trabalho > E-mails  |
| Telefone                   *  |  Assinatura                Trabalho         *  |
| Link da agenda                |                                                |
|-------------------------------|                                                |
| Lixeira                     3 |                                                |
+-------------------------------+------------------------------------------------+
```

Menu de contexto de um texto (de uma pasta, com Ordenar e Exportar no lugar de favoritos):

```text
  Recortar            Ctrl+X
  Copiar              Ctrl+C
  Colar               Ctrl+V
  ------------------------
  Renomear                F2
  Mover para...
  ------------------------
  Mover para cima
  Mover para baixo
  ------------------------
  Adicionar aos favoritos
  ------------------------
  Excluir                Del
```

Menu de contexto sobre uma seleção múltipla:

```text
  3 itens selecionados
  Recortar            Ctrl+X
  Copiar              Ctrl+C
  Colar               Ctrl+V
  ------------------------
  Mover para...
  ------------------------
  Adicionar aos favoritos
  Exportar       >
  ------------------------
  Excluir                Del
```

Lixeira selecionada:

```text
+-------------------------------+------------------------------------------------+
| [ Buscar... ] [+ Novo v] [...]|  Lixeira                                       |
| ( Favoritos )                 |                                                |
|                               |  Lixeira                                       |
| v Trabalho                    |  3 itens. Na lixeira, eles não aparecem no     |
|   ...                         |  menu de colagem, na busca nem nas exportações.|
|                               |  [Restaurar] [Excluir definitivamente]         |
|                               |                            [Esvaziar lixeira]  |
|                               |  Nome            Estava em        Excluído em  |
|                               |  ----------------------------------------------|
|                               |=>Proposta antiga Trabalho > Cli.. 14/10 09:12  |
|                               |  Rascunhos       Raiz             13/10 18:40  |
|                               |    Pasta com 3 textos                          |
|                               |  Endereço antigo Pessoal          02/10 11:05  |
|-------------------------------|                                                |
| => Lixeira                  3 |                                                |
+-------------------------------+------------------------------------------------+
```

Teclado (somente atalhos que funcionam igual em qualquer programa do Windows; o restante fica nos menus):

| Tecla | Na árvore |
| --- | --- |
| Clique / setas / Home / End | Seleciona um item |
| Ctrl+clique | Inclui ou retira o item da seleção |
| Shift+clique / Shift+setas | Seleciona o intervalo, na ordem visível |
| Ctrl+A | Seleciona todos os itens visíveis |
| Esc | Desfaz o recorte, se houver; senão, volta a seleção a um item |
| Enter | Texto: leva o foco ao conteúdo do editor. Pasta: abre ou fecha |
| → / ← | Abre ou fecha a pasta; ← num item vai para a pasta dele |
| Letras | Salta para o próximo item visível que começa com elas |
| F2 | Renomeia (um item) |
| Ctrl+X / Ctrl+C / Ctrl+V | Recorta, copia e cola itens |
| Ctrl+Z | Desfaz a última operação da árvore |
| Del | Move para a lixeira |
| Shift+Del | Exclui definitivamente, com confirmação |
| Ctrl+N / Ctrl+Shift+N / Ctrl+S | Novo texto / Nova pasta / gravar agora (já existentes) |

Regras:

1. **Seleção múltipla:** com mais de um item, o editor dá lugar ao painel da seleção (contagem e lista dos itens com o caminho) e às ações Mover para…, Recortar, Copiar, Adicionar aos favoritos (ou Remover, quando todos os textos já são favoritos; só com textos na seleção), Exportar e Excluir. Renomear e Mover para cima/baixo não aparecem. Clique direito fora da seleção seleciona só aquele item; dentro dela, o menu age em todos. Uma pasta selecionada leva junto os itens de dentro, mesmo que também estejam selecionados. As pendências do editor são gravadas antes de abrir o painel.
2. **Recortar, copiar e colar:** Ctrl+X e Ctrl+C marcam os itens selecionados; Ctrl+V cola no destino do `+ Novo` (pasta selecionada, pasta do texto selecionado ou raiz), no fim do grupo. Recortados são movidos e ficam esmaecidos até colar; Esc desfaz o recorte sem mover nada. Copiados são duplicados com todo o conteúdo; colar na mesma pasta duplica com " - Cópia" no nome (depois " - Cópia (2)"...), como no Explorer, e em outra pasta mantém o nome. A cópia começa sem favorito e com o uso zerado. Copiar um único texto também põe o conteúdo dele no clipboard do Windows, sem contar como uso. Colar fica desabilitado no menu sem itens marcados.
3. **Arrastar e soltar:** soltar sobre uma pasta (destacada) move para dentro dela, no fim do grupo; soltar entre itens (linha de inserção) coloca naquela posição. Pastas ficam sempre antes dos textos, então a linha só aparece em posições válidas. Ctrl ao soltar copia em vez de mover (o indicador mostra `+`). Parar sobre uma pasta fechada por 700 ms a abre; arrastar perto das bordas rola a árvore. Arrastar um item selecionado leva a seleção inteira, com a contagem no indicador. Soltar uma pasta nela mesma ou numa subpasta dela não é aceito. Soltar sobre a Lixeira exclui. Esc cancela.
4. **Ordenar:** submenu no menu de contexto da pasta e no botão `...` (Ordenar a raiz): Por nome (A–Z), Por mais usados, Por uso mais recente. Reorganiza uma vez os itens diretos (não os das subpastas): pastas sempre por nome, textos pelo critério, empates por nome. Depois disso, a ordem manual continua editável.
5. **Busca e filtro:** com a busca ou o filtro de favoritos ativos, arrastar, Mover para cima/baixo e Ordenar ficam indisponíveis, porque a ordem mostrada é parcial.
6. **Lixeira:** Excluir (Del) move os itens para a lixeira sem confirmação; uma pasta vai com todo o conteúdo. A notificação "N itens movidos para a lixeira." traz **Desfazer** e some após 6 segundos. A Lixeira fica fixa no fim da árvore, com a contagem, e aceita itens soltos sobre ela. Selecionada, mostra os itens excluídos (nome, de onde vieram, data), com seleção múltipla, Restaurar e Excluir definitivamente (também por item, ao passar o mouse) e Esvaziar lixeira. Restaurar devolve o item à pasta de origem, no fim do grupo, ou à raiz se a pasta não existir mais ou também estiver na lixeira. Itens na lixeira não aparecem na árvore, na busca, no menu de colagem, nos totais nem nas exportações, e só saem dela pelo usuário.
7. **Exclusão definitiva:** Shift+Del, Excluir definitivamente e Esvaziar lixeira pedem confirmação, informando o que vai junto (subpastas, textos, favoritos).
8. **Desfazer (Ctrl+Z):** com o foco na árvore, no painel da seleção ou na Lixeira, desfaz a última operação: excluir, mover (Mover para…, arrastar, recortar e colar), reordenar (Mover para cima/baixo, arrastar), ordenar, colar cópias e favoritar em lote. Guarda até 50 operações enquanto o aplicativo estiver aberto. Nos campos de texto, Ctrl+Z é o desfazer do próprio campo. Se uma operação não puder mais ser desfeita (por exemplo, o item foi excluído definitivamente), uma notificação informa e ela é descartada. Não há refazer.

### Importação e exportação

Botão `...` ao lado do `+ Novo`:

```text
[...]
  Importar       >   Arquivos .txt...
  Exportar tudo  >   Pasta...
                     Conteúdo de uma pasta...
                     Backup JSON...
                     ------------------------
                     Em Trabalho > E-mails

[...]
  Importar       >
  Exportar tudo  >   Backup JSON...
                     Pastas e arquivos .txt...

[...]
  Importar       >
  Exportar tudo  >
  ---------------
  Ordenar a raiz >   Por nome (A-Z)
  ---------------    Por mais usados
  Expandir tudo      Por uso mais recente
  Recolher tudo
```

Menu de contexto de uma pasta:

```text
  Recortar            Ctrl+X
  Copiar              Ctrl+C
  Colar               Ctrl+V
  ------------------------
  Renomear                F2
  Mover para...
  ------------------------
  Mover para cima
  Mover para baixo
  ------------------------
  Ordenar        >   Por nome (A-Z)
  Exportar       >   Por mais usados
  ---------------    Por uso mais recente
  Excluir                Del
```

Submenu Exportar da pasta:

```text
  Ordenar        >
  Exportar       >   Backup JSON...
                     Pastas e arquivos .txt...
```

Notificações de resultado (canto inferior direito, acima da barra inferior; a mais nova embaixo):

```text
                          +----------------------------------------+
                          | (v) 12 textos e 3 pastas importados [X]|
                          |     em Trabalho > E-mails.             |
                          |     2 arquivos ignorados:              |
                          |     - notas antigas.txt: não está em   |
                          |       UTF-8                            |
                          |     - logo.png: não é um arquivo .txt  |
                          +----------------------------------------+
                          | (v) 9 textos e 4 pastas exportados. [X]|
                          |     C:\Users\gabriel\Documents\CSTM    |
                          +----------------------------------------+
| (v) Todas as alterações salvas                  9 textos · 4 pastas |
```

| Opção | Seletor do Windows | Resultado |
| --- | --- | --- |
| Importar → Arquivos .txt… | abrir arquivos `.txt` (vários) | Um texto por arquivo no destino; título é o nome do arquivo sem `.txt` |
| Importar → Pasta… | escolher pasta | Cria a própria pasta no destino, com subpastas e textos |
| Importar → Conteúdo de uma pasta… | escolher pasta | Coloca as subpastas e os textos da pasta direto no destino |
| Importar → Backup JSON… | abrir arquivo `.json` | Recria pastas e textos no destino, com favoritos, ordem, contador de uso e datas |
| Exportar tudo / Exportar → Backup JSON… | salvar arquivo (`CSTM.json` ou `<pasta>.json`) | Um arquivo com tudo; substituir um arquivo existente é confirmado pelo seletor |
| Exportar tudo / Exportar → Pastas e arquivos .txt… | escolher pasta | Cria uma pasta nova (`CSTM` ou o nome da pasta, com `(2)` se já existir) com um `.txt` por texto; favoritos, ordem e uso não vão junto |

Regras:

1. O destino da importação é o mesmo do `+ Novo` (pasta selecionada, pasta do texto selecionado ou raiz) e aparece no rodapé do submenu Importar.
2. A importação só cria: nada é mesclado nem sobrescrito, mesmo com nomes repetidos; os itens entram no fim do grupo. Se algo falhar, nada é importado.
3. Na leitura dos `.txt`, somente UTF-8 (com ou sem BOM), com as quebras de linha convertidas para LF. Arquivos que não são `.txt`, vazios, fora de UTF-8 ou que não puderem ser lidos são ignorados, assim como links e junções, e listados na notificação (os 10 primeiros e a contagem dos demais).
4. Backup JSON inválido, de outro programa ou de versão mais nova não importa nada; a notificação de erro explica o motivo.
5. Antes de exportar, as alterações pendentes do editor são gravadas. A exportação em `.txt` nunca sobrescreve arquivos.
   Com itens selecionados, o Exportar do menu de contexto e do painel da seleção exporta só eles: uma pasta sozinha é exportada como no menu dela; vários itens vão dentro de uma pasta `CSTM`. O Exportar tudo do botão `...` exporta sempre a biblioteca inteira.
6. Cancelar o seletor não faz nada. Cada resultado vira uma notificação (Toast do Fluent UI) que entra deslizando pela direita; várias se empilham, a mais nova embaixo. A de sucesso some após 4 segundos, com o tempo pausado enquanto o mouse está sobre ela; a de erro fica até ser fechada. O `X` fecha qualquer uma.

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
| => Mais usados                     > |
|    Favoritos                       > |
|    Trabalho                        > |
|    Pessoal                         > |
|    Telefone                          |
|    Link da agenda                    |
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

Dentro de Mais usados (Favoritos é igual, por título):

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
| <  Mais usados                       |
| => Assinatura               Trabalho |
|    Resposta padrão           E-mails |
|    Telefone                          |
|    Follow-up                 E-mails |
|    Respostas rápidas         Pessoal |
+--------------------------------------+
| Enter colar  < voltar     Esc fechar |
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
- Janela de 340 × 440 (no modo cascata, ela cresce para conter as colunas abertas; ver Navegação nas pastas), sem bordas e sem barra de título, com cantos arredondados e sombra; sempre no topo e fora da barra de tarefas. Segue o tema claro ou escuro do sistema, como o cadastro.
- Campo de busca no topo, com foco automático, lista no meio (com rolagem) e uma linha de dicas de teclado no rodapé.
- Na raiz, sem cabeçalhos de seção: as pastas **Mais usados** e **Favoritos**, com ícones próprios e nessa ordem, seguidas das pastas e depois dos textos da raiz, cada grupo na ordem manual do cadastro. Mais usados e Favoritos não existem no cadastro: são calculadas a cada abertura e somem quando vazias.
- **Mais usados:** os 10 textos com mais usos (ao menos um), do mais para o menos usado; empates pelo uso mais recente. **Favoritos:** os textos favoritos, por título. Dentro das duas, cada texto mostra à direita a pasta em que está, como na busca. Um texto pode aparecer nelas e na sua pasta.
- Dentro de uma pasta: uma linha de volta com o caminho (`<  Trabalho > E-mails`) seguida das subpastas e dos textos da pasta, nessa ordem e na ordem manual de cada grupo.
- Pastas têm `>` à direita. Textos mostram só o título; o conteúdo aparece como dica (tooltip) ao passar o mouse.
- Com texto na busca, a lista é substituída pelos resultados (na ordem de relevância do backend), cada um com o nome da pasta em que está à direita, em cinza (o caminho completo fica na dica); textos da raiz não mostram pasta. A busca vale para toda a biblioteca, mesmo aberta dentro de uma pasta.

### Comportamento

| Ação | Resultado |
| --- | --- |
| `↑` / `↓`; `Home` / `End` com a busca vazia | Move a seleção (o foco fica no campo de busca); a primeira linha selecionável começa selecionada |
| `Enter` ou clique num texto | Fecha o menu e cola o texto no programa anterior |
| `Enter`, `→` ou clique numa pasta | Abre a pasta |
| `←` ou `Backspace` com a busca vazia, ou clique na linha de volta | Volta para a pasta acima |
| Digitar | Busca; a seleção volta para o primeiro resultado |
| `Esc`, clique fora ou `Alt+Q` | Fecha o menu sem colar |
| Passar o mouse | Move a seleção para a linha sob o cursor |

- Cada abertura começa na raiz, com a busca vazia, e recarrega os dados (refletindo as edições do cadastro).
- `→` e `←` só navegam pastas quando o cursor do campo de busca não teria para onde ir (busca vazia); com texto na busca, movem o cursor normalmente.

### Navegação nas pastas

Opção das Configurações (Tela 3), com dois modos. O modo vale na próxima abertura do menu.

| Modo | Comportamento |
| --- | --- |
| **Abrir ao passar o mouse** (padrão) | Cascata: o conteúdo de uma pasta abre numa coluna ao lado, como os submenus do Windows |
| **Clicar para abrir** | O comportamento descrito acima: clicar (ou `Enter`/`→`) numa pasta substitui a lista pelo conteúdo dela, com a linha de volta |

Os trechos acima (Estrutura, Comportamento e Estados) descrevem o modo "Clicar para abrir". A seguir, o que muda na cascata; o restante (atalho, posição inicial, colagem, busca, tema) é igual.

Cascata, com Trabalho aberto:

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
|    Mais usados                     > |
|    Favoritos                       > |  +----------------------------+
| => Trabalho                        > |  | => E-mails               > |
|    Pessoal                         > |  |    Saudação formal         |
|    Telefone                          |  |    Assinatura              |
|    Link da agenda                    |  +----------------------------+
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

(O desenho é esquemático: a coluna nova tem a altura do conteúdo e o topo alinhado à pasta que a abriu; ver Posição.)

Regras:

1. **Coluna principal:** igual à do modo clique: 340 × 440, busca no topo, pastas virtuais (Mais usados e Favoritos), pastas e textos da raiz. Não tem linha de volta, porque as pastas abrem ao lado. Ela não se move na tela quando colunas se abrem ou fecham. As subcolunas não têm campo de busca nem rodapé.
2. **Abertura:** passar o mouse sobre uma pasta abre a coluna dela na hora, sem atraso; clicar também abre. Vale para pastas reais e para Mais usados e Favoritos, em qualquer coluna.
3. **Troca e fechamento:** passar para outra pasta substitui as colunas abertas a partir dali. Passar sobre um texto fecha as colunas mais profundas que a coluna dele. Voltar à pasta que já está aberta não faz nada. Como não há atraso, atravessar outra pasta na diagonal até a coluna aberta troca as colunas; o movimento horizontal evita isso. A pasta que originou uma coluna fica realçada.
4. **Teclado:** `↑` / `↓` movem a seleção na coluna atual (e fecham as colunas à direita dela); `→` ou `Enter` numa pasta abre a coluna e entra nela, com o primeiro item selecionado; `←` fecha a coluna atual e volta à anterior, mantendo a pasta selecionada; `Enter` num texto cola; `Esc` fecha o menu, como hoje. `→` e `←` só navegam com a busca vazia. A seleção do mouse e a do teclado são a mesma.
5. **Busca:** com texto na busca, as subcolunas se fecham e os resultados continuam numa lista única, sem cascata (como no modo clique).
6. **Posição horizontal:** a coluna nova abre à direita da anterior (com 2 px de intervalo). Sem espaço na área útil, abre à esquerda da anterior. Sem espaço dos dois lados (ou se a esquerda cobriria colunas abertas), ela fica encostada na borda direita da área útil e as colunas mais antigas que ela cobre saem de vista, voltando quando a coluna nova fecha.
7. **Posição vertical:** (a) o topo da subcoluna fica alinhado ao topo da pasta que a abriu e a altura vem do conteúdo; (b) se passar da borda inferior da área útil, a coluna sobe o necessário para caber, podendo ficar acima da pasta e do topo da coluna principal; (c) se for maior que a área útil, ocupa toda a altura dela, com rolagem, e `↑` / `↓` rolam até o item selecionado.
8. **Janela e aparência:** a janela do picker é transparente, sem borda nem sombra nativa, e tem o tamanho do retângulo que envolve as colunas abertas, sempre dentro da área útil do monitor. Cada coluna é um cartão com fundo, cantos arredondados e sombra próprios, desenhados pela interface. Clicar na área transparente da janela (fora dos cartões) fecha o menu, como clicar fora.
9. **Reabertura:** ao abrir de novo (`Alt+Q`), o menu volta a uma coluna só, na raiz.

Os cenários de posição (normal, borda direita, borda inferior e coluna grande) podem ser experimentados no protótipo, com o contorno da área útil e da janela transparente.

### Estados

| Estado | Exibição |
| --- | --- |
| Biblioteca vazia | "Nenhum texto cadastrado." e o botão "Abrir cadastro" |
| Pasta vazia | "Pasta vazia." abaixo da linha de volta (na cascata, na coluna da pasta) |
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

Com a opção de navegação nas pastas (abaixo do atalho, separada por uma linha):

```text
+------------------------------------------------+
| Configurações                              [X] |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
| [ Alt + Q                        ] [ Alterar ] |
|                                                |
| ---------------------------------------------- |
| Navegação nas pastas                           |
| Como as pastas se abrem no menu de colagem.    |
| Vale a partir da próxima abertura do menu.     |
| (o) Abrir ao passar o mouse  padrão            |
| ( ) Clicar para abrir                          |
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

- Diálogo modal sobre a janela de cadastro, com título "Configurações" e botão de fechar. Tem duas configurações: o atalho do menu de colagem e a navegação nas pastas.
- **Navegação nas pastas:** grupo de opções exclusivas (`RadioGroup` do Fluent UI, rótulo "Navegação nas pastas") abaixo do atalho: **Abrir ao passar o mouse** (padrão, marcada na primeira abertura) e **Clicar para abrir**. A escolha é gravada ao selecionar, sem botão de confirmar, e vale na próxima abertura do menu de colagem (um menu já aberto não muda). "Restaurar padrão (Alt+Q)" restaura somente o atalho. Os modos estão descritos em Tela 2, Navegação nas pastas.
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
