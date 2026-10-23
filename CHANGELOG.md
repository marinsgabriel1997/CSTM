# Changelog

Todas as mudanças notáveis deste projeto são registradas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.1.0] - 2026-10-23

### Added

- No menu de colagem, selecionar uma imagem do Histórico (pelo teclado ou pelo mouse) abre ao lado da coluna um cartão com a imagem inteira e o tamanho, para reconhecê-la sem depender da miniatura da linha. Em telas sem espaço ao lado da coluna, o cartão não aparece.

## [1.0.1] - 2026-10-21

### Security

- A verificação de atualização deixa de aceitar certificados de autoridades intermediárias que perderam a confiança (bibliotecas de TLS atualizadas: `rustls-webpki` 0.103.16, RUSTSEC-2026-0382, e `webpki-roots` 1.0.10, RUSTSEC-2026-0381).

## [1.0.0] - 2026-10-20

Primeira versão estável.

### Added

- A aba Básico da Ajuda começa com um aviso sobre importar os textos que você já tem em pastas do Windows e arquivos .txt; o botão **Ver como importar** leva à explicação na aba Avançado.

### Changed

- A barra inferior do cadastro mostra o nome completo do aplicativo antes da versão ("CSTM — Clipboard, Snippets & Text Manager · v…"); em janelas com menos de 1000 px de largura, fica só "CSTM · v…".
- A introdução da Ajuda explica a sigla CSTM.
- A seção "Importar e exportar" da Ajuda explica cada opção de importação, incluindo como pastas e subpastas viram pastas e textos.

## [0.21.0] - 2026-10-19

### Added

- Busca na Ajuda: procura nas abas Básico e Avançado, sem diferenciar acentos, mostra quantas ocorrências cada aba tem e vai para a próxima ou a anterior com `Enter` e `Shift+Enter`, trocando de aba quando preciso.

### Changed

- A Ajuda ficou mais visual: cada passo do Básico e as principais seções do Avançado mostram a tela correspondente, com bordas vermelhas no que importa e números na ordem dos cliques, e os textos ficaram mais curtos e mais naturais.
- **Ajuda**, **Configurações** e **Sobre o CSTM** saíram da barra inferior e viraram linhas no painel da árvore, abaixo da Lixeira. A linha Ajuda fica em destaque até a primeira vez que você a abre.
- "Clipboard" virou "área de transferência" na Ajuda e nas Configurações, e as apresentações do Sobre e da biblioteca vazia foram reescritas.

## [0.20.0] - 2026-10-19

### Added

- Pasta **Raiz** na árvore do cadastro, logo abaixo do Histórico, com as pastas e os textos que não estão em nenhuma pasta. Selecionada, é o destino de **Novo**, **Colar** e **Importar**; tem menu próprio (Novo texto, Nova pasta, Colar, Ordenar e Exportar), aceita itens soltos sobre ela e pode ser recolhida, e a escolha é lembrada.
- **Novo texto** e **Nova pasta** no menu de contexto das pastas, que criam dentro delas, e no clique direito sobre o espaço vazio da árvore, que cria na raiz.
- Clicar no espaço vazio da árvore ou pressionar `Esc` tira a seleção, e os itens novos passam a ser criados na raiz.

### Changed

- O desinstalador sempre preserva os dados: a opção de apagá-los saiu, porque marcá-la sem querer apagava todos os textos. A Ajuda e o README explicam como apagar os dados pelo próprio CSTM ou removendo a pasta depois de desinstalar.
- O README explica a sigla CSTM: Clipboard, Snippets & Text Manager.
- Barras de rolagem finas, sem setas e no tom do tema, no cadastro e no menu de colagem.

### Fixed

- Num texto grande, a barra de rolagem do conteúdo fica na borda direita do editor, e não mais no meio da janela; o título fica parado e só o conteúdo rola. Vale também para os itens de texto do Histórico.

## [0.19.1] - 2026-10-19

### Changed

- A barra de versão nova, no topo do cadastro, ficou verde, com texto escuro e botões pretos nos dois temas, com ícone de download e o texto e os botões juntos no centro, para não passar despercebida.

## [0.19.0] - 2026-10-19

### Added

- Pasta **Histórico** no topo da árvore do cadastro, com os itens do histórico do clipboard: os textos podem ser editados (a formatação que veio junto é descartada e o item sobe para o topo) e qualquer item pode ir para a **Lixeira**, com **Desfazer**, ser restaurado ou excluído definitivamente.
- Versão do CSTM na barra inferior do cadastro, ao lado do botão de Configurações.
- Botão de lixeira (e a tecla `Delete`) no item selecionado do Histórico no menu de colagem, que manda o item para a Lixeira sem fechar o menu.

## [0.18.0] - 2026-10-19

### Added

- Verificação de atualização: o CSTM consulta o GitHub em segundo plano (a cada 7 dias por padrão, de 1 a 90, em **Configurações** › **Atualizações**) e, quando sai uma versão nova, avisa com uma notificação do Windows e uma barra no topo do cadastro que levam à página da release. **Verificar agora** consulta na hora; a opção pode ser desligada.

## [0.17.2] - 2026-10-17

### Changed

- Tauri atualizado para a 2.12.3, com correções da biblioteca base do aplicativo.

## [0.17.1] - 2026-10-16

### Added

- Política de segurança (`SECURITY.md`), com as versões que recebem correção e o reporte privado de vulnerabilidades pelo GitHub.
- Atualizações mensais das dependências pelo Dependabot, em pull requests revisados antes de entrar no projeto.

## [0.17.0] - 2026-10-16

### Added

- Opção **Depois de colar** nas Configurações: **Manter o que foi colado** deixa o texto colado na área de transferência, para colar de novo com `Ctrl+V` quando um programa não recebe a colagem; **Restaurar o conteúdo anterior** devolve o que estava copiado antes.

### Changed

- Depois de colar, o texto colado passa a ficar na área de transferência (**Manter o que foi colado**, o novo padrão, também para quem atualiza). Para voltar ao comportamento anterior, escolha **Restaurar o conteúdo anterior**.
- A restauração devolve o que estava copiado com a formatação (HTML e RTF) e imagens, não só o texto.

## [0.16.0] - 2026-10-15

### Added

- Modos de colagem para textos escritos em markdown: **Markdown** (como está), **Sem formatação**, **Formatado** (rich text para Word, Outlook, Gmail e Teams) e **Google Chat** (com a sintaxe do Chat). O modo padrão, usado por `Enter` e **Copiar**, é escolhido nas Configurações e começa em Markdown, que cola como antes; os outros três ficam em botões na linha do texto selecionado no menu de colagem.
- Modos de colagem também nos textos do Histórico do clipboard, em quatro botões na linha selecionada (`Enter` e **Copiar** continuam colando o original). O item é lido como markdown antes de converter: a formatação que veio junto (de um e-mail, documento ou da página do Chat) e a sintaxe do Google Chat (`*negrito*`, `~tachado~`) viram markdown, então dá para colar no Chat um markdown copiado ou colar formatada num e-mail uma mensagem do Chat.

### Changed

- A janela do cadastro abre, na primeira vez, proporcional à tela (75% da largura e 80% da altura da área útil, entre 1000 × 650 e 1600 × 1000) e passa a lembrar posição, tamanho e se estava maximizada. Antes, abria sempre em 1000 × 650, pequena em monitores 4K.
- No menu de colagem, as colunas ficam mais largas (420 px a principal e 380 px as abertas ao lado), os títulos longos ocupam até duas linhas antes das reticências e a dica de um texto mostra o título completo antes do conteúdo.

## [0.15.0] - 2026-10-14

### Added

- No menu de colagem em cascata, cada coluna aberta ao lado ganha um campo **Buscar em**, que filtra só aquela pasta e as subpastas dela, ou o Histórico, os Favoritos e os Mais usados. Entrar numa coluna pelo teclado leva o foco para o campo dela.

### Changed

- As colunas abertas ao lado no menu em cascata começam na altura do topo da coluna principal e descem até a barra de tarefas, rolando por dentro quando o conteúdo não cabe. Antes, uma pasta grande, como o Histórico, ocupava a tela de cima a baixo.

## [0.14.0] - 2026-10-14

### Added

- Ajuda dentro do aplicativo, com as abas Básico (onde clicar para começar) e Avançado (as demais funcionalidades). Abre pelo botão `?` da barra inferior, por `F1` ou pela bandeja, e aparece sozinha uma vez depois de instalar ou atualizar.
- Página Sobre o CSTM, com a versão, o link do projeto no GitHub, a pasta dos dados (com o botão Abrir pasta), a licença e o autor. Abre pelo botão `i` da barra inferior ou pela bandeja.
- O CSTM passa a ser distribuído sob a licença MIT.

### Changed

- As Configurações deixam de ser uma janela sobreposta e passam a ocupar a área do editor, como a Ajuda e o Sobre. Clicar de novo no botão, selecionar um item na árvore ou criar um texto volta ao editor.
- O menu da bandeja ganha os itens Ajuda e Sobre o CSTM.

## [0.13.0] - 2026-10-14

### Added

- Histórico do clipboard: o CSTM guarda os últimos 100 itens copiados em qualquer programa (textos, com a formatação, e imagens) e os mostra na nova pasta Histórico, no topo do menu de colagem. Escolher um item cola no programa anterior; o botão Copiar (ou `Ctrl+C`) o deixa no clipboard. O histórico continua lá depois de reiniciar, não repete itens e ignora o que gerenciadores de senha marcam como sensível e o que o próprio CSTM cola.
- Nas Configurações, a opção "Guardar o histórico do clipboard" (ligada por padrão) e o botão "Limpar histórico", com confirmação.
- O instalador mostra o link "CSTM no GitHub" na página final, e "Aplicativos instalados" do Windows passa a mostrar o link do projeto.

## [0.12.0] - 2026-10-14

### Added

- Opção "Iniciar com o Windows" nas Configurações, desligada por padrão: o CSTM abre só na bandeja ao entrar no Windows, com o atalho do menu de colagem já ativo. A opção acompanha a desativação feita pelo Gerenciador de Tarefas, e desinstalar o CSTM remove a entrada.
- Escolha do tema nas Configurações: seguir o Windows (como antes), claro ou escuro. Vale na hora no cadastro e no menu de colagem.
- No menu de colagem, a linha do texto selecionado ganha um botão Copiar (e o atalho `Ctrl+C`), que deixa o texto no clipboard sem colar, para usar onde e quando quiser. Clicar no texto continua colando.

## [0.11.3] - 2026-10-14

### Fixed

- O menu de colagem não pisca mais ao navegar entre pastas e subpastas na cascata: a janela fica fixa enquanto o menu está aberto, e as colunas abrem e fecham dentro dela. Clicar fora das colunas continua chegando ao programa de trás.
- Ao abrir, o menu de colagem não mostra mais por um instante o conteúdo da abertura anterior.

## [0.11.2] - 2026-10-14

### Fixed

- As janelas do CSTM só são criadas depois de o banco estar aberto; antes, quando a inicialização demorava (por exemplo, com o antivírus examinando o programa na primeira execução), o cadastro podia mostrar o erro "state not managed".
- Se o CSTM não consegue iniciar (pasta de dados, banco ou ícone da bandeja), uma mensagem mostra o motivo antes de ele fechar; antes, o aplicativo fechava sem nenhum aviso.

## [0.11.1] - 2026-10-14

### Fixed

- Na busca do menu de colagem, os textos com todos os termos no título aparecem antes dos que só os têm no conteúdo, com o título mais curto e direto primeiro; antes, um texto que repetia o termo no conteúdo podia ficar acima de um texto com o termo no título.
- No menu de colagem, títulos e pastas longos ficam em uma linha, cortados com reticências; antes, quebravam em duas linhas e invadiam as linhas vizinhas.

## [0.11.0] - 2026-10-14

### Added

- Ícone próprio do CSTM ("Prancheta"), usado na janela, na barra de tarefas, na bandeja, no Menu Iniciar e no instalador.
- As propriedades do `CSTM.exe` mostram editor, versão e copyright.

### Changed

- O build gera somente o instalador NSIS, em português, que instala o CSTM para o usuário atual em `%LOCALAPPDATA%\CSTM` sem pedir administrador; o instalador MSI deixou de ser gerado. Reinstalar ou desinstalar preserva os dados, a menos que a opção de apagar os dados seja marcada no desinstalador. Executar o instalador com o CSTM já instalado permite desinstalá-lo; ao fim da desinstalação, o instalador é encerrado.
- No aplicativo instalado, o menu de contexto do navegador (exceto nos campos de texto) e os atalhos F5, Ctrl+R, Ctrl+Shift+R, Ctrl+P, Ctrl+F, Ctrl+U e Ctrl+Shift+I não têm mais efeito; antes, F5 recarregava o cadastro e podia perder edições pendentes.

## [0.10.0] - 2026-10-14

### Added

- Menu de colagem em cascata: ao passar o mouse sobre uma pasta (ou ao clicar nela), o conteúdo dela abre numa coluna ao lado, alinhada à pasta e com a altura do conteúdo, como os submenus do Windows. Vale também para Mais usados e Favoritos. Passar para outra pasta substitui as colunas abertas; passar sobre um texto fecha as mais profundas.
- No teclado, `→` ou `Enter` numa pasta abre a coluna e entra nela, `←` volta uma coluna e `↑`/`↓` movem a seleção na coluna atual.
- As colunas se ajustam à área útil do monitor: abrem à esquerda perto da borda direita, sobem perto da borda inferior e rolam quando o conteúdo é maior que a tela; sem espaço dos dois lados, as colunas mais antigas saem de vista.
- Opção "Navegação nas pastas" nas Configurações, com "Abrir ao passar o mouse" (padrão) e "Clicar para abrir"; a escolha é gravada no banco e vale na próxima abertura do menu.

### Changed

- O menu de colagem passou a ser uma janela transparente em que cada coluna é um cartão com cantos arredondados e sombra próprios; clicar na área transparente fecha o menu. A cascata é o modo padrão, inclusive para quem já usava o aplicativo; "Clicar para abrir" mantém o comportamento anterior.

## [0.9.0] - 2026-10-14

### Added

- Seleção múltipla na árvore do cadastro (Ctrl+clique, Shift+clique, Shift+setas e Ctrl+A), com um painel que move, recorta, copia, favorita, exporta e exclui todos os itens de uma vez.
- Recortar, copiar e colar itens (Ctrl+X, Ctrl+C, Ctrl+V e menu de contexto). Colar cópias na mesma pasta duplica o item com " - Cópia" no nome; a cópia começa sem favorito e com uso zerado. Copiar um único texto também coloca o conteúdo dele no clipboard do Windows.
- Arrastar e soltar na árvore: mover para uma pasta, reordenar pela linha de inserção, copiar com Ctrl, abrir pastas fechadas ao parar sobre elas e enviar para a Lixeira.
- Lixeira no fim da árvore: Del envia os itens para ela com a notificação "Desfazer"; é possível restaurá-los, excluí-los definitivamente ou esvaziar a lixeira, com confirmação. Shift+Del exclui definitivamente. Itens na lixeira não aparecem na busca, no menu de colagem, nos totais nem nas exportações.
- Ctrl+Z desfaz as últimas operações da árvore (até 50), sem interferir no desfazer dos campos de texto.
- Submenu Ordenar (por nome, mais usados ou uso mais recente) nas pastas e na raiz, Expandir tudo e Recolher tudo no botão `...`, salto por letras digitadas e Enter para abrir pastas ou ir ao conteúdo do texto.
- O editor mostra quantas vezes o texto foi usado e quando foi usado pela última vez.
- O menu de colagem mostra as pastas Mais usados (os 10 textos mais colados) e Favoritos no topo da raiz.
- A exportação a partir de itens selecionados exporta somente eles.

### Changed

- Excluir passou a enviar os itens para a lixeira, sem confirmação, em vez de apagá-los na hora.
- Os atalhos Ctrl+M (Mover para…) e Alt+↑/↓ (Mover para cima/baixo) foram removidos; as ações continuam no menu de contexto.

### Removed

- A exclusão direta de pastas com confirmação foi substituída pela lixeira; a exclusão definitiva fica em Shift+Del, na própria Lixeira e em Esvaziar lixeira.

## [0.8.0] - 2026-10-14

### Added

- Importação pelo botão `...` ao lado de "Novo": arquivos `.txt` viram textos com o nome do arquivo como título; uma pasta do disco é importada com as subpastas, criando a própria pasta ou trazendo só o seu conteúdo; um backup JSON recria pastas e textos com ordem, favoritos, contador de uso e datas. Os itens entram na pasta selecionada e nunca substituem os existentes. Arquivos que não são `.txt`, vazios ou fora de UTF-8 são ignorados e listados na notificação de resultado; um backup inválido não importa nada.
- Exportação da biblioteca inteira (botão `...`) ou de uma pasta (menu de contexto) como backup JSON completo ou como pastas com um arquivo `.txt` por texto. A exportação em `.txt` cria uma pasta nova e nunca sobrescreve arquivos; nomes inválidos no Windows são ajustados. As alterações pendentes são gravadas antes de exportar.
- Notificações no canto inferior direito, que entram e saem deslizando e se empilham, para o resultado de importações e exportações. As de sucesso somem após 4 segundos; as de erro ficam até serem fechadas.

## [0.7.0] - 2026-10-13

### Added

- Escolher um texto no menu de colagem o cola no programa que estava ativo quando o atalho foi pressionado. Meio segundo depois, o texto que estava no clipboard volta para ele, a menos que algo novo tenha sido copiado nesse intervalo. Se o programa anterior não puder ser reativado, o texto fica no clipboard para ser colado manualmente.
- Cada colagem é contada no uso do texto.

## [0.6.0] - 2026-10-13

### Added

- Configurações, abertas pela engrenagem na barra inferior do cadastro ou pelo menu do ícone na bandeja: o atalho do menu de colagem pode ser trocado pressionando a nova combinação. O novo atalho vale na hora e é lembrado entre execuções; se outro programa já usar a combinação, o atalho anterior continua valendo. "Restaurar padrão" volta para `Alt+Q`.

### Changed

- O aviso de atalho indisponível mostra o atalho configurado e oferece "Alterar atalho".

## [0.5.0] - 2026-10-13

### Added

- Menu de colagem aberto por `Alt+Q` em qualquer programa, junto ao cursor do mouse e sempre dentro da tela: busca em todos os textos, favoritos e pastas navegáveis, pelo teclado (setas, `Enter`, `→`/`←`, `Esc`) ou pelo mouse. Escolher um texto o copia para o clipboard; `Esc`, clicar fora ou `Alt+Q` fecham o menu.
- Aviso no cadastro quando o atalho `Alt+Q` não pode ser registrado, por exemplo por já estar em uso por outro programa.

## [0.4.0] - 2026-10-13

### Added

- Ícone na bandeja do sistema: o clique abre o cadastro e o menu oferece "Abrir cadastro" e "Sair".
- Apenas uma instância do aplicativo por vez: abri-lo de novo traz a janela que já está aberta.

### Changed

- Fechar a janela apenas a oculta, gravando as alterações; o aplicativo continua na bandeja e os textos que não puderam ser gravados permanecem em memória. A confirmação para descartar esses textos passa a acontecer ao escolher "Sair".

## [0.3.0] - 2026-10-13

### Added

- Tela de cadastro na janela principal, no visual do Windows 11 (Fluent UI) e acompanhando o tema claro ou escuro do sistema: uma árvore única com pastas e textos à esquerda e o editor sempre aberto à direita, separados por um divisor arrastável.
- Salvamento automático: os textos são gravados após uma pausa na digitação, ao trocar de item e quando a janela perde o foco (`Ctrl+S` grava na hora). A barra inferior mostra o estado do salvamento e os totais da biblioteca.
- Textos com título ou conteúdo vazio não são gravados, mas também não se perdem: ficam marcados na árvore até serem corrigidos, mantendo a última versão salva. Falhas ao gravar mantêm as alterações e oferecem "Tentar novamente"; fechar a janela com algo que não pôde ser gravado pede confirmação.
- Criação pelo botão "Novo" (`Ctrl+N` para texto, `Ctrl+Shift+N` para pasta), na pasta selecionada; a pasta nova é nomeada na própria árvore.
- Menu de contexto (clique direito ou botão "…") para renomear (`F2`), mover para outra pasta (`Ctrl+M`), reordenar (`Alt+↑`/`Alt+↓`), favoritar e excluir (`Del`). Excluir pede confirmação e informa o que vai junto: subpastas, textos e favoritos.
- Editor com o caminho da pasta no topo, título em destaque e conteúdo editados diretamente; selecionar uma pasta mostra seu resumo, com atalhos para criar dentro dela.
- Busca em títulos e conteúdos que filtra a própria árvore, mantendo as pastas dos resultados, destacando o termo e mostrando um trecho quando a correspondência é só no conteúdo. Filtro de favoritos com o mesmo comportamento.
- Navegação pela árvore com o teclado (setas, Home, End, Enter). A largura da árvore e as pastas recolhidas são lembradas entre execuções.
- Primeiro uso com apresentação do aplicativo e atalhos para criar o primeiro texto ou pasta.
- Testes automatizados do frontend (`npm run test`).

### Changed

- A janela principal abre com 1000×650 e não pode ser reduzida abaixo de 760×480.

## [0.2.0] - 2026-10-13

### Added

- Banco SQLite em `%APPDATA%\com.gabriel.cstm\cstm.db`, criado e migrado automaticamente ao iniciar o aplicativo.
- Persistência de pastas (com subpastas) e textos no backend: criação, edição, exclusão, ordenação manual, movimentação entre pastas, favoritos, contagem de uso e busca por título e conteúdo que ignora acentos e aceita prefixos. Ainda sem interface.
- Testes automatizados do backend (`npm run test:rust`).

## [0.1.1] - 2026-10-13

### Added

- Lint do frontend com ESLint (`npm run lint`).
- Lint do backend com clippy (`npm run lint:rust`) e formatação com rustfmt (`npm run format:rust`).
- Quebras de linha LF fixadas via `.gitattributes`.

### Removed

- Exemplo do template (comando `greet`, plugin `opener` e logotipos de Vite, Tauri e React); a janela principal exibe apenas uma tela mínima.
