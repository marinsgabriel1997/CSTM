# Ajuda do CSTM: como escrever os tutoriais

Guia para criar ou alterar o conteúdo da página Ajuda (Tela 4 de [`telas.md`](telas.md)) mantendo o padrão: texto curto, imagens das telas e marcações vermelhas numeradas na ordem dos cliques.

## Onde fica cada coisa

| O quê | Onde |
| --- | --- |
| Textos, ordem dos passos e seções, imagem de cada um | [`src/helpContent.ts`](../src/helpContent.ts) |
| Exibição: abas, busca, marcações `[n]`, imagens | [`src/components/HelpPage.tsx`](../src/components/HelpPage.tsx) |
| Imagens (WebP, geradas) | [`src/assets/ajuda/`](../src/assets/ajuda/) |
| Lista de capturas e o gerador | [`scripts/ajuda-imagens.mjs`](../scripts/ajuda-imagens.mjs) |
| Telas de onde saem as capturas | [`docs/prototipo/`](prototipo/) (`cadastro.html`, `picker.html`, `configuracoes.html`, `ajuda.html`) |
| Protótipo da própria Ajuda, com o mesmo texto | [`docs/prototipo/ajuda.html`](prototipo/ajuda.html) |

## Quando atualizar

- Toda mudança visível ao usuário (funcionalidade, atalho, nome de botão ou fluxo) atualiza o texto da Ajuda na mesma entrega.
- Se a mudança altera uma tela que aparece numa imagem da Ajuda, primeiro o protótipo é atualizado (o protótipo é a fonte das capturas), depois as imagens afetadas são geradas de novo e conferidas.
- O texto do `ajuda.html` acompanha o `helpContent.ts`: depois de mexer no texto, rode `node scripts/ajuda-imagens.mjs --prototipo`.

## Texto

- **Curto e direto.** Diga onde clicar e o que acontece. O que a imagem já mostra não é descrito em detalhe; o que ela não mostra (atalhos, regras, exceções) fica no texto.
- **Português natural**, na segunda pessoa ("Clique em…", "você pode…"). Evite construções truncadas ("Copiar só copia"), repetições na mesma frase e termos técnicos sem necessidade. Prefira "área de transferência" a "clipboard". Mudanças de frase relevantes são mostradas ao usuário (antes → depois) e aprovadas antes de aplicar.
- **Nomes exatamente como na interface**, em negrito: `**Novo**`, `**Esvaziar lixeira**`. Confira o nome no componente antes de citar.
- **Marcação** (interpretada pelo `HelpPage`):

  | Marcação | Vira |
  | --- | --- |
  | `**texto**` | negrito, para botões, menus e nomes de tela |
  | `` `tecla` `` | tecla (`kbd`), por exemplo `` `Ctrl+N` `` |
  | `{atalho}` | o atalho do menu de colagem configurado pelo usuário |
  | `[1]`, `[2]`… | círculo vermelho numerado, igual ao da imagem |

- **Números `[n]`** seguem a ordem dos cliques e correspondem aos círculos da imagem do mesmo passo ou seção: "Clique em **Novo** [1] › **Novo texto** [2]". Use número só quando há ordem; destaque sem ordem fica só com o retângulo na imagem e sem número no texto.
- **Aba Básico:** só o caminho para começar, um passo por ação, todos com imagem. **Aba Avançado:** uma seção por funcionalidade; seções só de regras (limites do Windows, desinstalar) ficam sem imagem.
- **Busca:** o campo **Buscar na Ajuda** procura em todo o texto visível das duas abas (títulos, parágrafos, teclas), sem diferenciar acentos; descrições das imagens e números `[n]` não entram. Use as palavras que a pessoa procuraria ("lixeira", "atalho", "importar").

## Imagens

- **Fonte:** capturas dos protótipos HTML, nunca prints do aplicativo à mão. Assim a geração é reproduzível e usa dados de exemplo neutros.
- **Tema claro** sempre; no tema escuro do aplicativo, a borda leve separa a imagem da página.
- **Densidade 2x:** o script captura com o dobro de pixels para ficar nítido em telas de alta resolução, e a página mostra a imagem com `srcSet="<url> 2x"`, sem `src`. Com `src`, o navegador a usa como 1x e a imagem aparece com o dobro do tamanho.
- **Recorte focado:** só a região que interessa, legível na largura da coluna da Ajuda (cerca de 540 px). Evite a janela inteira e áreas vazias; no painel da árvore, recorte até as linhas (`.tree .row`), não até a Lixeira. Use a janela inteira só quando a ação envolve partes distantes (por exemplo, o editor e a barra inferior).
- **Marcações:**
  - retângulo vermelho (`#D13438`, 3 px, cantos de 6 px, afastado 4 px do alvo) em volta de cada coisa que a pessoa deve ver;
  - círculo vermelho numerado (22 px, número branco em negrito, borda branca) no canto superior esquerdo do retângulo, quando há ordem de cliques;
  - no máximo três ou quatro marcações por imagem; o que não é o assunto do passo fica sem marcação.
- **Descrição (`alt`)** obrigatória, dizendo o que a imagem mostra ("Menu do botão Novo aberto, com o item Novo texto."), sem repetir o texto do passo.
- **Nome do arquivo:** `basico-<n>-<assunto>.webp` para os passos do Básico e `avancado-<assunto>.webp` para as seções do Avançado.

## Como criar ou alterar uma captura

1. **Estado no protótipo.** Abra o protótipo e escolha (ou crie) o estado que mostra a cena: os estados ficam no objeto `STATES` e aparecem na barra superior; a URL aceita `#estado=<chave>&tema=claro` (no picker, também `nav=` e `cenario=`). Se a cena não existe, acrescente um estado ao protótipo, com nota explicando para que serve. Para ver o estado como o script o enxerga, sem marcações: `node scripts/ajuda-imagens.mjs --explorar cadastro.html "estado=importar" saida.png`.
2. **Entrada na lista `CAPTURAS`** de `scripts/ajuda-imagens.mjs`:

   ```js
   {
     name: "avancado-importar",          // vira src/assets/ajuda/avancado-importar.webp
     page: "cadastro.html",              // protótipo em docs/prototipo/
     hash: "estado=importar",            // estado (o script acrescenta tema=claro)
     pad: 0,                             // folga do recorte em px (padrão 12)
     actions: [{ hover: ALVO }],         // opcional: hover ou click antes da captura
     clip: [".tree-head", ".menu"],      // recorte = união das caixas dos alvos + pad
     marks: [
       { target: "[title='Importar e exportar']", n: 1 },          // com número
       { target: { css: ".menu .item", text: "Importar" }, n: 2 },
       { target: ".row.trash" },                                  // sem número
     ],
   }
   ```

   Alvos aceitos (em `clip`, `marks` e `actions`):
   - seletor CSS: o primeiro elemento que casa; em `clip`, todos os que casam;
   - `{ css, text }`: o primeiro elemento do seletor cujo texto contém `text`. Prefira esta forma a seletores frágeis por posição;
   - `{ css, nth }`: escolhe pela posição (negativo conta do fim);
   - `{ css, text, closest }`: sobe até o ancestral `closest`;
   - lista de alvos: a união das caixas, por exemplo para marcar um grupo de botões.

   O recorte cresce sozinho para caber as marcações e os círculos. Um alvo inexistente aborta a geração com mensagem clara, sem gravar imagem.
3. **Gerar:** `npm run ajuda:imagens -- <nome>` gera só as capturas citadas; sem nomes, gera todas.
4. **Usar no texto:** importe a imagem em `helpContent.ts` e associe ao passo ou seção com `image: { src, alt }`; acrescente os `[n]` ao texto.
5. **Sincronizar o protótipo da Ajuda:** `node scripts/ajuda-imagens.mjs --prototipo`.

## Conferência antes de entregar

- [ ] Cada imagem gerada ou alterada foi aberta e conferida: recorte certo, sem barra de estados do protótipo nem sobras de outras telas, marcações em volta do alvo certo, números na ordem dos cliques e iguais aos `[n]` do texto.
- [ ] No `ajuda.html` (que mostra as imagens em 2x, como o aplicativo), a imagem fica legível e sem altura exagerada na largura da coluna, nos temas claro e escuro.
- [ ] Os nomes em negrito existem na interface com essa grafia.
- [ ] A busca encontra o passo ou a seção pelas palavras que a pessoa usaria.
- [ ] `npm run test`, `npm run build` e `npm run lint` passando (os testes da Ajuda conferem as imagens pelo `alt` e a marcação `[n]`).
