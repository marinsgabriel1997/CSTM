// Conteúdo da página Ajuda (Tela 4 de docs/telas.md), num lugar só. Atualizar na mesma
// entrega de toda mudança visível ao usuário (funcionalidade, atalho ou fluxo).
// Marcação: **negrito** para botões e menus, `tecla` para teclas; {atalho} vira o atalho configurado;
// [1], [2]... viram o círculo numerado da marcação correspondente na imagem.
// As imagens saem dos protótipos de docs/prototipo/ com `npm run ajuda:imagens` (scripts/ajuda-imagens.mjs).
// Padrão de texto, imagens e marcações: docs/ajuda.md.

import avancadoArvore from "./assets/ajuda/avancado-arvore.webp";
import avancadoBusca from "./assets/ajuda/avancado-busca.webp";
import avancadoConfiguracoes from "./assets/ajuda/avancado-configuracoes.webp";
import avancadoFavoritos from "./assets/ajuda/avancado-favoritos.webp";
import avancadoHistorico from "./assets/ajuda/avancado-historico.webp";
import avancadoImportar from "./assets/ajuda/avancado-importar.webp";
import avancadoLixeira from "./assets/ajuda/avancado-lixeira.webp";
import avancadoModos from "./assets/ajuda/avancado-modos.webp";
import basicoBandeja from "./assets/ajuda/basico-6-bandeja.webp";
import basicoEscolher from "./assets/ajuda/basico-5-escolher.webp";
import basicoMenu from "./assets/ajuda/basico-4-menu-de-colagem.webp";
import basicoNovoTexto from "./assets/ajuda/basico-1-novo-texto.webp";
import basicoPastas from "./assets/ajuda/basico-3-pastas.webp";
import basicoTitulo from "./assets/ajuda/basico-2-titulo-conteudo.webp";

export interface HelpImage {
  src: string;
  /** Descrição da imagem para leitores de tela. */
  alt: string;
}

export interface HelpStep {
  title: string;
  text: string;
  image?: HelpImage;
}

export interface HelpSection {
  title: string;
  paragraphs: string[];
  image?: HelpImage;
}

export const HELP_INTRO = "O CSTM salva textos para você reutilizar rapidamente em qualquer programa, sem precisar ficar copiando do Bloco de Notas. Para começar:";

/** Aba Básico: onde clicar para começar. */
export const BASIC_STEPS: HelpStep[] = [
  {
    title: "Crie um texto",
    text: "Clique em **Novo** [1] › **Novo texto** [2], ou use `Ctrl+N`.",
    image: { src: basicoNovoTexto, alt: "Menu do botão Novo aberto, com o item Novo texto." },
  },
  {
    title: "Escreva o título e o conteúdo",
    text: "Escreva o título [1] e o conteúdo [2]. O CSTM salva automaticamente; a barra inferior avisa quando tudo estiver salvo.",
    image: { src: basicoTitulo, alt: "Editor com o título e o conteúdo de um texto e o aviso Todas as alterações salvas." },
  },
  {
    title: "Organize em pastas, se quiser",
    text: "Crie pastas em **Novo** › **Nova pasta** (`Ctrl+Shift+N`) e arraste os textos [1] para dentro delas [2].",
    image: { src: basicoPastas, alt: "Árvore com dois textos sendo arrastados para a pasta Clientes." },
  },
  {
    title: "Abra o menu de colagem em qualquer programa",
    text: "Clique onde quer colar (um e-mail, um documento, um formulário) e pressione `{atalho}`. O menu abre ao lado do cursor do mouse; para buscar, é só digitar.",
    image: { src: basicoMenu, alt: "Menu de colagem aberto junto ao mouse, com o campo Buscar no topo." },
  },
  {
    title: "Escolha o texto",
    text: "Clique no texto [1] para colá-lo. O botão **Copiar** [2] apenas copia o texto, para você colar depois com `Ctrl+V`.",
    image: { src: basicoEscolher, alt: "Menu de colagem com um texto selecionado e o botão Copiar na linha dele." },
  },
  {
    title: "Pode fechar a janela",
    text: "O CSTM continua rodando na bandeja, perto do relógio do Windows, e o atalho segue funcionando. Para encerrar, clique com o botão direito no ícone [1] e depois em **Sair** [2].",
    image: { src: basicoBandeja, alt: "Ícone do CSTM na bandeja do Windows, com o menu aberto e o item Sair." },
  },
];

/** Aba Avançado: as demais funcionalidades. */
export const ADVANCED_SECTIONS: HelpSection[] = [
  {
    title: "Busca",
    paragraphs: [
      "No cadastro, **Buscar** [1] filtra a árvore por título e conteúdo, sem diferenciar acentos, e **Favoritos** [2] mostra só os textos favoritos.",
      "No menu de colagem, basta digitar: a busca procura em todos os textos e mostra a pasta de cada resultado. Nas colunas abertas ao lado, **Buscar em** procura só naquela pasta; ao entrar numa coluna com `→`, a busca dela já fica pronta para digitar.",
    ],
    image: { src: avancadoBusca, alt: "Árvore do cadastro com o campo Buscar e o botão Favoritos." },
  },
  {
    title: "Favoritos e Mais usados",
    paragraphs: [
      "Marque um texto como favorito pela estrela no editor ou pelo menu do item na árvore.",
      "No topo do menu de colagem ficam **Favoritos** e **Mais usados** (os 10 textos mais colados), quando têm algum texto.",
    ],
    image: { src: avancadoFavoritos, alt: "Menu de colagem com as pastas Mais usados e Favoritos no topo." },
  },
  {
    title: "Textos no menu de colagem",
    paragraphs: [
      "Títulos longos ocupam até duas linhas. Para ler o título inteiro e o conteúdo, deixe o mouse parado sobre o texto.",
    ],
  },
  {
    title: "Modos de colagem",
    paragraphs: [
      "Escreva os textos em markdown (`**negrito**`, `_itálico_`, `- listas`, `# títulos`) e escolha como colar: **Markdown** (como está), **Sem formatação** (sem as marcas), **Formatado** (negrito, listas e links de verdade, para Word, Outlook, Gmail e Teams) ou **Google Chat** (`*negrito*`, `_itálico_`, `~tachado~`).",
      "`Enter` e **Copiar** usam o modo padrão, escolhido em **Configurações** › **Modo de colagem padrão**. Os outros três ficam em botões na linha do texto selecionado.",
      "No **Histórico**, `Enter` e **Copiar** colam o item como foi copiado, e os quatro modos ficam em botões. A formatação que veio junto e a sintaxe do Chat são entendidas: dá para colar no Chat um texto em markdown ou colar num e-mail, já formatada, uma mensagem copiada do Chat.",
      "O Google Chat não tem títulos nem links com texto: os títulos viram negrito e os links aparecem como texto seguido do endereço.",
    ],
    image: { src: avancadoModos, alt: "Linha selecionada no menu de colagem com os botões dos outros modos de colagem." },
  },
  {
    title: "Menu de colagem pelo teclado",
    paragraphs: [
      "`↑` e `↓` escolhem a linha, `Enter` cola, `Ctrl+C` copia sem colar e `Esc` fecha.",
      "Com a busca vazia, `→` abre uma pasta e `←` volta.",
      "Em **Configurações** › **Navegação nas pastas**, escolha se as pastas abrem ao passar o mouse (em colunas ao lado) ou ao clicar.",
    ],
  },
  {
    title: "Histórico da área de transferência",
    paragraphs: [
      "A pasta **Histórico**, no topo do menu de colagem, guarda os últimos 100 itens copiados em qualquer programa: textos (com a formatação) e imagens. Senhas copiadas de gerenciadores de senha não são guardadas.",
      "Clique num item para colá-lo, ou use **Copiar**. O ícone de lixeira na linha selecionada (ou `Delete`) manda o item para a **Lixeira** do cadastro.",
      "No cadastro, o **Histórico** fica no topo da árvore: selecione um texto para editá-lo (ao gravar, a formatação que veio junto é descartada e o item sobe para o topo) ou use **Excluir** (`Delete`).",
      "Em **Configurações**, desligue o histórico ou apague tudo com **Limpar histórico**.",
    ],
    image: { src: avancadoHistorico, alt: "Pasta Histórico aberta no menu de colagem, com textos e uma imagem copiados." },
  },
  {
    title: "Organizar a árvore",
    paragraphs: [
      "Arraste textos e pastas para mudar a ordem ou a pasta; segure `Ctrl` ao soltar para copiar em vez de mover.",
      "`Ctrl+X`, `Ctrl+C` e `Ctrl+V` recortam, copiam e colam itens, `Ctrl+Z` desfaz e `F2` renomeia. Selecione vários itens com `Ctrl` ou `Shift` + clique.",
      "Os itens novos são criados na pasta selecionada. A pasta **Raiz** reúne o que não está em nenhuma pasta: com ela selecionada, ou sem seleção (clique no espaço vazio da árvore ou `Esc`), **Novo**, `Ctrl+V` e **Importar** usam a raiz.",
      "O menu de uma pasta (clique direito ou **⋯**) permite criar, colar, ordenar (por nome, por mais usados ou por uso recente) e exportar o conteúdo dela; o menu da **Raiz** faz o mesmo com a raiz.",
    ],
    image: { src: avancadoArvore, alt: "Árvore com a pasta Raiz e o menu de contexto de uma pasta aberto." },
  },
  {
    title: "Lixeira",
    paragraphs: [
      "`Delete` manda os itens selecionados para a **Lixeira** [1], no fim da árvore; `Shift+Delete` exclui definitivamente, com confirmação.",
      "Na Lixeira, **Restaurar** devolve os itens selecionados ao lugar de onde vieram, e **Esvaziar lixeira** apaga tudo.",
    ],
    image: { src: avancadoLixeira, alt: "Lixeira aberta, com os botões Restaurar e Esvaziar lixeira." },
  },
  {
    title: "Importar e exportar",
    paragraphs: [
      "Em **⋯** [1] › **Importar** [2]: arquivos .txt (um texto por arquivo), uma pasta do disco ou um backup JSON. Os itens entram na pasta selecionada.",
      "Em **⋯** › **Exportar tudo**: backup JSON completo ou pastas com arquivos .txt. O menu de uma pasta exporta só ela.",
    ],
    image: { src: avancadoImportar, alt: "Menu do botão Mais opções aberto, com Importar." },
  },
  {
    title: "Configurações",
    paragraphs: [
      "Abra pela linha **Configurações** [1], no rodapé do painel, abaixo da Lixeira, ou pelo ícone da bandeja. Ali ficam o atalho do menu de colagem, navegação nas pastas, modo de colagem padrão, o que fazer depois de colar, tema, iniciar com o Windows, histórico da área de transferência e atualizações.",
      "Em **Atualizações**, o CSTM consulta o GitHub a cada 7 dias (você pode escolher de 1 a 90) para saber se saiu uma versão nova, sem enviar nenhum dado seu. Quando sai, aparecem uma notificação do Windows e uma barra no topo do cadastro com **Abrir página da release**, onde você baixa o instalador; **Dispensar** esconde a barra até a próxima versão. **Verificar agora** consulta na hora.",
    ],
    image: { src: avancadoConfiguracoes, alt: "Página Configurações aberta pela linha Configurações, no rodapé do painel." },
  },
  {
    title: "Desinstalar e apagar os dados",
    paragraphs: [
      "Desinstalar o CSTM (em **Configurações** › **Aplicativos** do Windows) sempre guarda os seus textos, para uma reinstalação encontrar tudo como estava.",
      "Para apagar os dados antes de desinstalar, exclua os itens, esvazie a **Lixeira** e use **Limpar histórico**. Depois de desinstalar, basta apagar a pasta `%APPDATA%\\com.gabriel.cstm`.",
    ],
  },
  {
    title: "Limites do Windows",
    paragraphs: [
      "Alguns programas, como os abertos como administrador, não aceitam a colagem do CSTM, e o Windows não avisa. O texto escolhido continua na área de transferência: se a colagem falhar, é só pressionar `Ctrl+V`, ou usar **Copiar** no menu de colagem e colar com `Ctrl+V`.",
      "Em **Configurações** › **Depois de colar**, **Restaurar o conteúdo anterior** devolve à área de transferência, logo depois da colagem, o que estava copiado antes (texto, formatação e imagens; arquivos copiados no Explorer não voltam). Com essa opção, uma colagem que falhou não fica disponível para `Ctrl+V`.",
    ],
  },
];
