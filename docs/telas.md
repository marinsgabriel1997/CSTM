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
| (v) Todas as alterações salvas              9 textos · 4 pastas  [⚙] (?) (i)  |
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
| Barra inferior | Estado do salvamento à esquerda; totais de textos e pastas à direita, sem contar a lixeira, seguidos dos botões Configurações, Ajuda e Sobre o CSTM (Tela 3, Páginas na área do editor). |
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
| Clique direito no ícone | Menu: **Abrir cadastro**, **Configurações**, **Ajuda**, **Sobre o CSTM**, separador, **Sair** |
| Configurações, Ajuda ou Sobre o CSTM | Mostra a janela de cadastro já com a página escolhida na área do editor |
| Sair | Grava as pendências e encerra; se algo não puder ser gravado, mostra a janela e pede confirmação ("Sair sem salvar?") |
| Executar o aplicativo de novo | Não cria outra instância; traz a janela existente |
| Windows iniciando o CSTM ao entrar na sessão (opção Iniciar com o Windows) | Não cria outra instância nem mostra a janela |

A janela abre visível ao iniciar o aplicativo, exceto quando o Windows o inicia ao entrar na sessão (opção **Iniciar com o Windows** nas Configurações): aí o CSTM fica só na bandeja, com o atalho ativo. Não há aviso de que o aplicativo continua na bandeja ao fechar a janela.

**Tamanho e posição:** na primeira abertura, a janela ocupa 75% da largura e 80% da altura da área útil (sem a barra de tarefas) do monitor principal, entre 1000 × 650 e 1600 × 1000, centralizada; numa área menor que o piso, ocupa a área inteira, sem ficar abaixo do mínimo de 760 × 480. Ao fechar a janela e ao sair, o CSTM guarda posição, tamanho e se estava maximizada, e a reabre assim (maximizada, guarda também o tamanho normal para quando for desmaximizada). Se a posição guardada ficar fora de todos os monitores (por exemplo, um monitor desconectado), volta à regra da primeira abertura.

## Tela 2 — Menu de colagem (janela `picker`)

Protótipo visual navegável: [`docs/prototipo/picker.html`](prototipo/picker.html) (abre direto no navegador; estados e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

Raiz (estado ao abrir):

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
| => Histórico                       > |
|    Mais usados                     > |
|    Favoritos                       > |
|    Trabalho                        > |
|    Pessoal                         > |
|    Telefone                          |
|    Link da agenda                    |
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

Dentro do Histórico:

```text
+--------------------------------------+
| [ Buscar...                        ] |
+--------------------------------------+
| <  Histórico                         |
| => Reunião confirmada para qu… 14:32 |
|    [img] Imagem 1920 × 1080    14:10 |
|    Proposta comercial — resumo 11:05 |
|    https://github.com/marins…  ontem |
+--------------------------------------+
| Enter colar  < voltar     Esc fechar |
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
- Coluna de 420 × 440 (no modo cascata, outras colunas abrem ao lado; ver Navegação nas pastas), sem bordas e sem barra de título, com cantos arredondados e sombra; sempre no topo e fora da barra de tarefas. Segue o tema escolhido nas Configurações (por padrão, o do Windows), como o cadastro.
- Campo de busca no topo, com foco automático, lista no meio (com rolagem) e uma linha de dicas de teclado no rodapé.
- Na raiz, sem cabeçalhos de seção: as pastas **Histórico**, **Mais usados** e **Favoritos**, com ícones próprios (relógio, chama e estrela) e nessa ordem, seguidas das pastas e depois dos textos da raiz, cada grupo na ordem manual do cadastro. As três não existem no cadastro: são calculadas a cada abertura e somem quando vazias; o Histórico também some com a opção "Guardar o histórico do clipboard" desligada (Tela 3).
- **Histórico:** os itens copiados em qualquer programa (no máximo 100), do mais recente para o mais antigo, com a hora da cópia à direita, em cinza (de outro dia, "ontem" ou a data `dd/mm`). Um texto mostra a primeira linha não vazia, e a dica mostra o conteúdo (encurtado se for longo). Uma imagem mostra uma miniatura no lugar do ícone e "Imagem L × A" (em pixels), com a mesma frase na dica. A formatação HTML/RTF de um texto não aparece no menu, mas vai junto ao colar.
- **Mais usados:** os 10 textos com mais usos (ao menos um), do mais para o menos usado; empates pelo uso mais recente. **Favoritos:** os textos favoritos, por título. Dentro das duas, cada texto mostra à direita a pasta em que está, como na busca. Um texto pode aparecer nelas e na sua pasta.
- Dentro de uma pasta: uma linha de volta com o caminho (`<  Trabalho > E-mails`) seguida das subpastas e dos textos da pasta, nessa ordem e na ordem manual de cada grupo.
- Pastas têm `>` à direita. Textos mostram só o título; a dica (tooltip nativa do Windows) ao passar o mouse mostra o título completo, uma linha em branco e o conteúdo (nos resultados da busca e nas listas que mostram a pasta, o caminho vem entre o título e o conteúdo).
- Títulos de textos, pastas e itens do Histórico quebram em até 2 linhas antes das reticências; uma linha com título curto mantém a altura de uma linha.
- A linha de texto selecionada (pelo mouse ou pelo teclado) mostra à direita um botão pequeno **Copiar**, com o ícone de duas folhas sobrepostas e a dica "Copiar (Ctrl+C)". Os itens do Histórico também têm o botão. Pastas, Histórico, Mais usados, Favoritos e a linha de volta não têm.
- **Modos de colagem:** a linha de texto cadastrado selecionada mostra também, antes do Copiar, três botões pequenos só de ícone, um para cada modo de colagem que não é o padrão (Tela 3). Os modos são **Markdown** (o conteúdo como está), **Sem formatação** (sem a marcação markdown), **Formatado** (rich text gerado do markdown) e **Google Chat** (sintaxe do Google Chat), com as dicas "Colar como markdown", "Colar sem formatação", "Colar formatado" e "Colar para o Google Chat". Os botões ficam por cima do fim da linha (sobre a pasta e o fim do título), com o fundo da seleção, para o título não mudar de altura ao selecionar. Num item de texto do Histórico selecionado aparecem os quatro botões, porque ali `Enter`, clique e Copiar colam o original; imagens não têm modos. Para converter um item do Histórico, o CSTM lê primeiro o item como markdown: a formatação que veio junto (HTML com negrito, itálico, tachado, código, listas, títulos, links ou citação) vira markdown; sem ela, um texto na sintaxe do Google Chat (`*x*` ou `~x~` de um caractere, sem `**` nem `~~`) tem `*x*` lido como negrito e `~x~` como tachado; os demais textos valem como estão. O item guardado não muda: a conversão acontece só ao colar. Não há atalhos de teclado para os modos.

```text
| => Resposta padrão    [md][Aa][G] ⧉ |
```
- Com texto na busca, a lista é substituída pelos resultados (só dos textos cadastrados; o Histórico fica de fora da busca) (na ordem de relevância do backend: primeiro os textos com todos os termos no título, do título mais relevante, em geral o mais curto, ao menos; depois os que só batem no conteúdo), cada um com o nome da pasta em que está à direita, em cinza (o caminho completo fica na dica); textos da raiz não mostram pasta. A busca vale para toda a biblioteca, mesmo aberta dentro de uma pasta.

### Comportamento

| Ação | Resultado |
| --- | --- |
| `↑` / `↓`; `Home` / `End` com a busca vazia | Move a seleção (o foco fica no campo de busca); a primeira linha selecionável começa selecionada |
| `Enter` ou clique num texto | Fecha o menu e cola o texto no programa anterior, no modo de colagem padrão (Tela 3) |
| Botão de modo de colagem num texto | Fecha o menu e cola o texto no programa anterior naquele modo; o resto é igual à colagem padrão (conta como uso e restaura o clipboard anterior) |
| `Enter` ou clique num item do Histórico | Fecha o menu e cola o item no programa anterior: o texto com a formatação, se havia (o programa escolhe o formato que aceita), ou a imagem. Depois, o texto que estava no clipboard volta, como na colagem de um texto cadastrado. O item sobe para o topo do Histórico |
| Botão de modo de colagem num item de texto do Histórico | Fecha o menu e cola o item convertido para aquele modo (ver Modos de colagem); o resto é igual à colagem do item |
| Botão Copiar, ou `Ctrl+C` com um texto selecionado | Fecha o menu e deixa o texto no clipboard (num texto cadastrado, no modo de colagem padrão), sem colar e sem restaurar o conteúdo anterior; o foco volta ao programa anterior. Conta como uso, como a colagem. Com um trecho da busca selecionado, `Ctrl+C` copia o trecho, como em qualquer campo. Num item do Histórico, deixa o item no clipboard (com todos os formatos) e o sobe para o topo |
| `Enter`, `→` ou clique numa pasta | Abre a pasta |
| `←` ou `Backspace` com a busca vazia, ou clique na linha de volta | Volta para a pasta acima |
| Digitar | Busca; a seleção volta para o primeiro resultado |
| `Esc`, clique fora ou `Alt+Q` | Fecha o menu sem colar |
| Passar o mouse | Move a seleção para a linha sob o cursor |

- Cada abertura começa na raiz, com a busca vazia, e recarrega os dados (refletindo as edições do cadastro e as cópias novas do Histórico).
- Colar ou copiar pelo CSTM não cria itens novos no Histórico.
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
+--------------------------------------+  +----------------------------+
| [ Buscar...                        ] |  | [ Buscar em Trabalho     ] |
+--------------------------------------+  +----------------------------+
|    Mais usados                     > |  | => E-mails               > |
|    Favoritos                       > |  |    Saudação formal         |
| => Trabalho                        > |  |    Assinatura              |
|    Pessoal                         > |  +----------------------------+
|    Telefone                          |
|    Link da agenda                    |
+--------------------------------------+
| Enter colar  > abrir      Esc fechar |
+--------------------------------------+
```

(A coluna nova começa na altura do topo da coluna principal e tem a altura do conteúdo, até a borda inferior da área útil; ver regra 7.)

Regras:

1. **Coluna principal:** igual à do modo clique: 420 × 440, busca no topo, pastas virtuais (Histórico, Mais usados e Favoritos), pastas e textos da raiz. Não tem linha de volta, porque as pastas abrem ao lado. Ela não se move na tela quando colunas se abrem ou fecham. As subcolunas não têm rodapé; cada uma tem no topo um campo de busca próprio, sempre visível (regra 5).
2. **Abertura:** passar o mouse sobre uma pasta abre a coluna dela na hora, sem atraso; clicar também abre. Vale para pastas reais e para Histórico, Mais usados e Favoritos, em qualquer coluna.
3. **Troca e fechamento:** passar para outra pasta substitui as colunas abertas a partir dali. Passar sobre um texto fecha as colunas mais profundas que a coluna dele. Voltar à pasta que já está aberta não faz nada. Como não há atraso, atravessar outra pasta na diagonal até a coluna aberta troca as colunas; o movimento horizontal evita isso. A pasta que originou uma coluna fica realçada.
4. **Teclado:** o teclado age no campo que tem o foco: o da coluna principal ao abrir o menu, ou o de uma subcoluna. `↑` / `↓` movem a seleção na coluna do campo (e fecham as colunas à direita dela); `→` ou `Enter` numa pasta abre a coluna, entra nela com o primeiro item selecionado e leva o foco para o campo dela; `←` fecha a coluna atual, volta à anterior mantendo a pasta selecionada e devolve o foco ao campo dela; `Enter` num texto cola e `Ctrl+C` copia, como no modo clique; `Esc` fecha o menu, em qualquer campo. `→` e `←` só navegam com o campo vazio. Clicar no campo de uma subcoluna leva o foco para ele; passar o mouse não move o foco. A seleção do mouse e a do teclado são a mesma.
5. **Busca:**
   - **Principal:** com texto na busca da coluna principal, as subcolunas se fecham e os resultados continuam numa lista única, sem cascata (como no modo clique).
   - **Na subcoluna:** o campo do topo (placeholder "Buscar em <pasta>", com ✕ para limpar quando tem texto) filtra só a partir daquela pasta, e digitar nele fecha as colunas à direita e seleciona o primeiro resultado. Numa pasta do cadastro, mostra os textos dela e de todas as subpastas, pela mesma regra e ordem da busca principal, sem pastas; os textos de subpastas mostram à direita o nome da subpasta, e o caminho completo fica na dica. Em Favoritos e Mais usados, mostra os textos da lista que batem com a busca, na ordem de relevância. No Histórico, mostra os itens cujo título ou prévia (os primeiros 500 caracteres) têm todos os termos, como prefixo de palavra e sem diferenciar acento ou caixa, na ordem do Histórico; uma imagem bate com "imagem". Sem resultados, mostra "Nenhum texto encontrado.". O filtro dura enquanto a coluna está aberta: trocar a pasta dela, fechá-la ou reabrir o menu o descarta.
6. **Posição horizontal:** as subcolunas têm 380 de largura. A coluna nova abre à direita da anterior (com 2 px de intervalo). Sem espaço na área útil, abre à esquerda da anterior. Sem espaço dos dois lados (ou se a esquerda cobriria colunas abertas), ela fica encostada na borda direita da área útil e as colunas mais antigas que ela cobre saem de vista, voltando quando a coluna nova fecha.
7. **Posição vertical:** toda subcoluna, em qualquer nível, começa na altura do topo da coluna principal (mesmo se ela estiver fora de vista) e tem a altura do conteúdo, incluindo o campo de busca, até a borda inferior da área útil (a barra de tarefas ou a borda da tela). Se o conteúdo não couber, a coluna rola por dentro, e `↑` / `↓` rolam até o item selecionado. Como a coluna principal sempre cabe na área útil, a subcoluna tem pelo menos a altura dela. A pasta que abriu a coluna fica realçada (regra 3).
8. **Janela e aparência:** a janela do picker é transparente, sem borda nem sombra nativa, e ocupa a área útil do monitor em que abriu, sem mudar de tamanho nem de lugar enquanto o menu está aberto; assim, abrir e fechar colunas não faz a janela piscar. Ela é recortada (região da janela) em volta das colunas visíveis, com uma margem para a sombra: fora do recorte nada é desenhado e o clique vai para o programa de trás, que fecha o menu ao receber o foco. Cada coluna é um cartão com fundo, cantos arredondados e sombra próprios, desenhados pela interface. Clicar na área transparente dentro do recorte (sombra e intervalo entre cartões) também fecha o menu.
9. **Reabertura:** ao abrir de novo (`Alt+Q`), o menu volta a uma coluna só, na raiz. A janela aparece sem recorte (invisível) e só mostra a coluna principal depois de desenhá-la, para não exibir o conteúdo da abertura anterior.

Os cenários de posição (normal, borda direita, borda inferior e coluna grande) podem ser experimentados no protótipo, com o contorno da área útil e do retângulo que envolve as colunas.

### Estados

| Estado | Exibição |
| --- | --- |
| Biblioteca vazia (e sem itens no Histórico) | "Nenhum texto cadastrado." e o botão "Abrir cadastro" |
| Pasta vazia | "Pasta vazia." abaixo da linha de volta (na cascata, na coluna da pasta) |
| Busca sem resultados | "Nenhum texto encontrado." |
| Falha ao carregar | Mensagem de erro do backend no lugar da lista |

## Tela 3 — Configurações (página na janela `main`)

Protótipo visual navegável: [`docs/prototipo/configuracoes.html`](prototipo/configuracoes.html) (abre direto no navegador; estados e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

As Configurações, a Ajuda (Tela 4) e o Sobre (Tela 5) são páginas que ocupam a área do editor no cadastro, no lugar do texto ou da pasta selecionada; a árvore continua à esquerda e funciona normalmente.

```text
+--------------------------------------------------------------------------------+
| CSTM                                                                           |
+-------------------------------+------------------------------------------------+
| [ Buscar... ] [+ Novo v] [...]|  Configurações                                 |
| ( Favoritos )                 |                                                |
|                               |  Atalho do menu de colagem                     |
| v Trabalho                    |  Abre o menu de colagem em qualquer programa.  |
|   Saudação formal          *  |  [ Alt + Q                     ] [ Alterar ]   |
| > Pessoal                     |  [ Restaurar padrão (Alt+Q) ]                  |
| Telefone                   *  |  --------------------------------------------  |
|                               |  Navegação nas pastas                          |
|                               |  ...                                           |
|-------------------------------|                                                |
| Lixeira                     3 |                                                |
+-------------------------------+------------------------------------------------+
| (v) Todas as alterações salvas              9 textos · 4 pastas  [⚙] (?) (i)  |
+--------------------------------------------------------------------------------+
```

Página com todas as opções (cada uma separada da anterior por uma linha):

```text
+------------------------------------------------+
| Configurações                                  |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
| [ Alt + Q                        ] [ Alterar ] |
| [ Restaurar padrão (Alt+Q) ]                   |
| ---------------------------------------------- |
| Navegação nas pastas                           |
| Como as pastas se abrem no menu de colagem.    |
| Vale a partir da próxima abertura do menu.     |
| (o) Abrir ao passar o mouse  padrão            |
| ( ) Clicar para abrir                          |
| ---------------------------------------------- |
| Modo de colagem padrão                         |
| Como Enter e Copiar colam os textos no menu.   |
| Os outros modos ficam em botões na linha.      |
| (o) Markdown  padrão                           |
| ( ) Sem formatação                             |
| ( ) Formatado                                  |
| ( ) Google Chat                                |
| ---------------------------------------------- |
| Tema                                           |
| (o) Seguir o Windows  ( ) Claro  ( ) Escuro    |
| ---------------------------------------------- |
| [ o] Iniciar com o Windows                     |
|      Abre na bandeja ao entrar no Windows,     |
|      com o atalho já ativo.                    |
| ---------------------------------------------- |
| [o ] Guardar o histórico do clipboard          |
|      Guarda no computador os últimos 100 itens |
|      copiados em qualquer programa (textos,    |
|      com a formatação, e imagens) e os mostra  |
|      na pasta Histórico do menu de colagem. O  |
|      que gerenciadores de senha marcam como    |
|      sensível não é guardado.                  |
|      [ Limpar histórico ]                      |
+------------------------------------------------+
```

Confirmando a limpeza do histórico (no lugar do botão):

```text
| [o ] Guardar o histórico do clipboard          |
|      ...                                       |
|      Apagar os 37 itens do histórico? Não é    |
|      possível desfazer.                        |
|      [ Limpar ]  [ Cancelar ]                  |
```

Gravando um novo atalho:

```text
+------------------------------------------------+
| Configurações                                  |
|                                                |
| Atalho do menu de colagem                      |
| Abre o menu de colagem em qualquer programa.   |
| [ Pressione o novo atalho...    ] [Cancelar]   |
| Esc cancela e mantém o atalho atual.           |
| [ Restaurar padrão (Alt+Q) ]  (desabilitado)   |
+------------------------------------------------+
```

### Páginas na área do editor

- A barra inferior tem, à direita dos totais, três botões de ícone: **Configurações** (engrenagem), **Ajuda** (`?`) e **Sobre o CSTM** (`i`). O botão da página aberta fica marcado (pressionado).
- Clicar num desses botões abre a página no lugar do editor; clicar de novo no botão da página aberta volta ao editor.
- Também voltam ao editor: selecionar um item na árvore (inclusive a Lixeira), criar um texto ou uma pasta e qualquer ação que abra um item no editor. Os rascunhos não são afetados; o salvamento automático continua.
- `F1`, em qualquer ponto do cadastro, abre a Ajuda.
- Com uma página aberta, os atalhos da árvore (`Ctrl+N`, `Delete`, `Ctrl+C`/`X`/`V`/`Z`) valem quando o foco está na árvore; nos campos e textos da página, as teclas ficam com a página (por exemplo, `Ctrl+C` copia o texto selecionado da Ajuda).
- A página rola quando não cabe na altura da janela; o conteúdo tem largura máxima de leitura, alinhado à esquerda.

### Estrutura

- Página com título "Configurações", sem botão de fechar (ver Páginas na área do editor). Tem seis configurações, nesta ordem: o atalho do menu de colagem, a navegação nas pastas, o modo de colagem padrão, o tema, a inicialização com o Windows e o histórico do clipboard.
- **Navegação nas pastas:** grupo de opções exclusivas (`RadioGroup` do Fluent UI, rótulo "Navegação nas pastas") abaixo do atalho: **Abrir ao passar o mouse** (padrão, marcada na primeira abertura) e **Clicar para abrir**. A escolha é gravada ao selecionar, sem botão de confirmar, e vale na próxima abertura do menu de colagem (um menu já aberto não muda). "Restaurar padrão (Alt+Q)" restaura somente o atalho, sem mexer nas demais opções. Os modos estão descritos em Tela 2, Navegação nas pastas.
- **Modo de colagem padrão:** opções exclusivas (`RadioGroup`, rótulo "Modo de colagem padrão"): **Markdown** (padrão, cola o conteúdo como está, como antes desta opção existir), **Sem formatação**, **Formatado** e **Google Chat**. Vale para `Enter`, clique e Copiar nos textos cadastrados do menu de colagem; os outros três modos aparecem como botões na linha selecionada (Tela 2). A escolha é gravada ao selecionar e vale na próxima abertura do menu. Não afeta o Histórico, que cola o original com `Enter`, clique e Copiar e oferece os quatro modos em botões.
- **Tema:** opções exclusivas em linha (rótulo "Tema"): **Seguir o Windows** (padrão), **Claro** e **Escuro**. A escolha é gravada ao selecionar e vale na hora no cadastro (inclusive na barra de título) e no menu de colagem. "Seguir o Windows" acompanha a troca de tema do sistema com o aplicativo aberto.
- **Iniciar com o Windows:** interruptor (`Switch` do Fluent UI), desligado por padrão, com a explicação "Abre na bandeja ao entrar no Windows, com o atalho já ativo." Ligar cria a entrada do CSTM na inicialização do Windows do usuário; desligar a remove. O estado mostrado vem do Windows: se o CSTM for desativado no Gerenciador de Tarefas, a opção aparece desligada. Uma falha ao ler ou alterar aparece numa faixa de erro abaixo do interruptor.
- **Histórico do clipboard:** interruptor "Guardar o histórico do clipboard", ligado por padrão, com a explicação do que é guardado. Desligar para de guardar na hora, sem apagar os itens já guardados (a pasta Histórico some do menu enquanto a opção estiver desligada); religar volta a guardar as próximas cópias. Abaixo, o botão **Limpar histórico**, desabilitado quando não há itens. Ele pede confirmação no mesmo lugar ("Apagar os N itens do histórico? Não é possível desfazer.", com **Limpar** em vermelho e **Cancelar**); ao confirmar, apaga todos os itens e mostra "Histórico limpo.". Falhas ao ler, alterar ou limpar aparecem numa faixa de erro abaixo da seção.
- O atalho aparece como teclas (`Alt` + `Q`) num campo somente leitura, com o botão "Alterar" ao lado.
- "Restaurar padrão (Alt+Q)" fica logo abaixo do campo do atalho, desabilitado quando o atalho já é o padrão ou durante a gravação.

### Como abrir

| Origem | Ação |
| --- | --- |
| Barra inferior do cadastro | Botão de engrenagem à direita dos totais |
| Menu da bandeja | Item **Configurações**: mostra a janela já na página |
| Aviso de atalho indisponível | Ação **Alterar atalho** abre a página |

### Comportamento

| Ação | Resultado |
| --- | --- |
| Alterar | O campo passa a aguardar a combinação ("Pressione o novo atalho…") e o botão vira "Cancelar"; o atalho atual fica suspenso, para poder ser pressionado também |
| Pressionar modificadores | O campo mostra os modificadores pressionados (`Ctrl` + `…`) |
| Combinação válida | Vira o novo atalho imediatamente; aparece "Atalho alterado." |
| Combinação inválida | Mostra a regra ("Use Ctrl ou Alt (com Shift, se quiser) e uma letra, número, F1–F12 ou Espaço.") e continua aguardando |
| `Esc`, "Cancelar", sair da página ou ocultar a janela | Encerra a gravação e reativa o atalho atual |
| Restaurar padrão | Volta para `Alt+Q` |

Regras das combinações: `Ctrl` ou `Alt` obrigatório, `Shift` opcional, sem `Win`; tecla principal entre letras, números, `F1`–`F12` e `Espaço`. A tecla é a física (independe do layout do teclado).

### Estados

| Estado | Exibição |
| --- | --- |
| Atalho em uso por outro programa | Faixa de erro: "Não foi possível usar Ctrl+Shift+V: outro programa pode estar usando esse atalho. O atalho Alt+Q continua valendo." |
| Combinação com `Ctrl+Alt` | Aceita, com faixa de aviso: "Atalhos com Ctrl+Alt podem bloquear caracteres digitados com AltGr (por exemplo, AltGr+Q digita “/” no teclado ABNT2)." |
| Atalho atual indisponível ao iniciar | O aviso do cadastro informa o atalho configurado e oferece "Alterar atalho" |

## Tela 4 — Ajuda (página na janela `main`)

Protótipo visual navegável: [`docs/prototipo/ajuda.html`](prototipo/ajuda.html) (abas, atalho configurado, bandeja e tema claro/escuro na barra superior). O protótipo é estático e não faz parte do aplicativo.

```text
+------------------------------------------------+
| Ajuda                                          |
|                                                |
|  Básico   Avançado                             |
|  ======                                        |
| O CSTM guarda os textos que você digita toda   |
| hora e os cola em qualquer programa. Para      |
| começar:                                       |
|                                                |
| (1) Crie um texto                              |
|     Na árvore, à esquerda, clique em Novo ›    |
|     Novo texto (ou Ctrl+N).                    |
| (2) Escreva o título e o conteúdo              |
|     ...                                        |
+------------------------------------------------+
```

- Página na área do editor (ver Tela 3, Páginas na área do editor), com o título "Ajuda" e duas abas (`TabList` do Fluent UI): **Básico**, selecionada ao abrir, e **Avançado**.
- **Básico:** uma frase de introdução e passos curtos e numerados de onde clicar para começar: criar um texto; escrever título e conteúdo (salva sozinho); organizar em pastas; pressionar o atalho em qualquer programa para abrir o menu de colagem junto ao mouse; clicar no texto para colar, ou no botão Copiar para só copiar; fechar a janela sem perder o atalho, que continua valendo pela bandeja.
- **Avançado:** seções curtas, com título: Busca; Favoritos e Mais usados; Menu de colagem pelo teclado; Histórico do clipboard; Organizar a árvore; Lixeira; Importar e exportar; Configurações; Limites do Windows.
- O texto cita o atalho configurado (por exemplo, "pressione Alt+Q" ou o atalho escolhido nas Configurações). Teclas aparecem como teclas (`kbd`), e nomes de botões e menus em negrito.
- O conteúdo fica em `src/helpContent.ts`, num lugar só; ele é atualizado na mesma entrega de toda mudança visível ao usuário.
- **Primeira execução:** enquanto a configuração `help_shown` não existe, o cadastro abre na Ajuda, aba Básico, e o CSTM grava a chave; nas execuções seguintes, abre normalmente. Vale também para quem atualiza de uma versão anterior. Iniciado pelo Windows, o CSTM fica na bandeja, e a Ajuda aparece quando a janela for mostrada. A apresentação da biblioteca vazia ("Bem-vindo ao CSTM") continua aparecendo no editor depois que a Ajuda é fechada.

## Tela 5 — Sobre o CSTM (página na janela `main`)

Protótipo visual navegável: [`docs/prototipo/sobre.html`](prototipo/sobre.html). O protótipo é estático e não faz parte do aplicativo.

```text
+------------------------------------------------+
| [ícone]  CSTM                                  |
|          Clipboard, Snippets & Text Manager ·  |
|          versão 0.14.0                         |
|                                                |
| Cadastre os textos que você digita toda hora,  |
| organize-os em pastas e cole-os em qualquer    |
| programa pelo menu de colagem. O CSTM também   |
| guarda o histórico do que você copia.          |
|                                                |
| Código-fonte                                   |
| github.com/marinsgabriel1997/CSTM              |
|                                                |
| Pasta dos dados                                |
| C:\Users\voce\AppData\Roaming\com.gabriel.cstm |
| [ Abrir pasta ]                                |
|                                                |
| Licença MIT · © 2026 Gabriel de Marins         |
+------------------------------------------------+
```

- Página na área do editor (ver Tela 3, Páginas na área do editor), aberta pelo botão `i` da barra inferior ou pelo item **Sobre o CSTM** da bandeja.
- Cabeçalho com o ícone do aplicativo, o nome, "Clipboard, Snippets & Text Manager" e a versão instalada (a do aplicativo, igual à de `package.json`).
- O link do repositório abre <https://github.com/marinsgabriel1997/CSTM> no navegador padrão.
- "Pasta dos dados" mostra o caminho da pasta de dados (onde fica o `cstm.db`), com o botão **Abrir pasta**, que a abre no Explorer.
- Rodapé: "Licença MIT · © 2026 Gabriel de Marins".
- Falhas ao abrir o link ou a pasta aparecem numa faixa de erro abaixo do item.

## Ícone do aplicativo

Ícone "Prancheta": quadrado azul `#0F6CBD` de cantos arredondados, folha branca com presilha âmbar `#FFB900` e três linhas de texto azuis. Aparece na janela, na barra de tarefas, na bandeja, no Menu Iniciar e no instalador. A fonte é `src-tauri/icons/icon.svg`; os demais formatos de `src-tauri/icons/` são gerados com `npx tauri icon src-tauri/icons/icon.svg` (o `icon.ico` contém 16, 24, 32, 48, 64 e 256 px). As opções avaliadas, em 16, 32 e 256 px sobre fundo claro e escuro, estão em `docs/prototipo/icone.html`.
