// Conteúdo da página Ajuda (Tela 4 de docs/telas.md), num lugar só. Atualizar na mesma
// entrega de toda mudança visível ao usuário (funcionalidade, atalho ou fluxo).
// Marcação: **negrito** para botões e menus, `tecla` para teclas; {atalho} vira o atalho configurado.

export interface HelpStep {
  title: string;
  text: string;
}

export interface HelpSection {
  title: string;
  paragraphs: string[];
}

export const HELP_INTRO = "O CSTM guarda os textos que você digita toda hora e os cola em qualquer programa. Para começar:";

/** Aba Básico: onde clicar para começar. */
export const BASIC_STEPS: HelpStep[] = [
  {
    title: "Crie um texto",
    text: "Na árvore, à esquerda, clique em **Novo** › **Novo texto** (ou `Ctrl+N`).",
  },
  {
    title: "Escreva o título e o conteúdo",
    text: "O CSTM salva sozinho enquanto você digita; a barra inferior mostra quando tudo está salvo.",
  },
  {
    title: "Organize em pastas, se quiser",
    text: "Use **Novo** › **Nova pasta** (ou `Ctrl+Shift+N`) e arraste os textos para dentro dela.",
  },
  {
    title: "Abra o menu de colagem em qualquer programa",
    text: "Clique onde quer colar (um e-mail, um documento, um formulário) e pressione `{atalho}`: o menu abre junto ao mouse.",
  },
  {
    title: "Escolha o texto",
    text: "Clique no texto para colá-lo. O botão **Copiar**, na linha selecionada, só copia, para você colar depois com `Ctrl+V`.",
  },
  {
    title: "Pode fechar a janela",
    text: "O CSTM continua no ícone da bandeja, perto do relógio do Windows, e o atalho continua valendo. Para encerrar, clique no ícone com o botão direito › **Sair**.",
  },
];

/** Aba Avançado: as demais funcionalidades. */
export const ADVANCED_SECTIONS: HelpSection[] = [
  {
    title: "Busca",
    paragraphs: [
      "No cadastro, o campo **Buscar** filtra a árvore por título e conteúdo, sem diferenciar acentos. O botão **Favoritos** mostra só os textos favoritos.",
      "No menu de colagem, é só digitar: a busca vale para todos os textos, e cada resultado mostra a pasta em que está.",
    ],
  },
  {
    title: "Favoritos e Mais usados",
    paragraphs: [
      "Marque um texto como favorito pela estrela no editor ou pelo menu do item na árvore.",
      "No topo do menu de colagem ficam as pastas **Favoritos** e **Mais usados** (os 10 textos mais colados). Elas só aparecem quando têm algum texto.",
    ],
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
    title: "Histórico do clipboard",
    paragraphs: [
      "A pasta **Histórico**, no topo do menu de colagem, guarda os últimos 100 itens copiados em qualquer programa: textos, com a formatação, e imagens.",
      "Clique num item para colá-lo, ou use **Copiar**. O que gerenciadores de senha marcam como sensível não é guardado.",
      "Em **Configurações**, desligue o histórico ou apague tudo com **Limpar histórico**.",
    ],
  },
  {
    title: "Organizar a árvore",
    paragraphs: [
      "Arraste textos e pastas para mudar a ordem ou a pasta; segure `Ctrl` ao soltar para copiar em vez de mover.",
      "`Ctrl+X`, `Ctrl+C` e `Ctrl+V` recortam, copiam e colam itens, `Ctrl+Z` desfaz e `F2` renomeia. Selecione vários itens com `Ctrl` ou `Shift` + clique.",
      "O botão **⋯** (Mais opções) ordena a raiz por nome, por mais usados ou por uso recente; o menu de uma pasta faz o mesmo com o conteúdo dela.",
    ],
  },
  {
    title: "Lixeira",
    paragraphs: [
      "`Delete` manda os itens selecionados para a **Lixeira**, no fim da árvore; `Shift+Delete` exclui definitivamente, com confirmação.",
      "Na Lixeira, restaure o que precisar ou esvazie-a.",
    ],
  },
  {
    title: "Importar e exportar",
    paragraphs: [
      "Em **⋯** › **Importar**: arquivos .txt (um texto por arquivo), uma pasta do disco ou um backup JSON. Os itens entram na pasta selecionada.",
      "Em **⋯** › **Exportar tudo**: backup JSON completo ou pastas com arquivos .txt. O menu de uma pasta exporta só ela.",
    ],
  },
  {
    title: "Configurações",
    paragraphs: [
      "Pela engrenagem na barra inferior ou pelo ícone da bandeja: atalho do menu de colagem, navegação nas pastas, tema, iniciar com o Windows e histórico do clipboard.",
    ],
  },
  {
    title: "Limites do Windows",
    paragraphs: [
      "Programas abertos como administrador não recebem a colagem do CSTM; nesse caso, use **Copiar** e cole com `Ctrl+V`.",
      "Depois de colar, o CSTM devolve ao clipboard o texto que estava nele; outros formatos, como imagens, não voltam.",
    ],
  },
];
