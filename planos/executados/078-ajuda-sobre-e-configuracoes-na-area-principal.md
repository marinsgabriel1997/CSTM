# 078 — Ajuda, Sobre e Configurações na área principal

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

Dar ao usuário uma ajuda dentro do próprio aplicativo e um Sobre, e tirar as Configurações do diálogo sobreposto. As três telas passam a aparecer na área principal do cadastro, onde hoje fica o editor de textos:

- **Ajuda:** abas **Básico** (onde clicar para começar, sem aprofundar) e **Avançado** (as demais funcionalidades). Por estar no aplicativo, a ajuda acompanha a versão instalada.
- **Sobre:** nome, versão, descrição, link do GitHub, pasta dos dados, licença MIT e autor.
- **Configurações:** o conteúdo do diálogo atual, como página.

## Contexto

- Hoje as Configurações são um diálogo modal (`SettingsDialog.tsx`). Abrem pela engrenagem da barra inferior, pelo item **Configurações** do menu da bandeja (evento `settings-requested`) e pela ação **Alterar atalho** do aviso de atalho indisponível.
- A área à direita da árvore mostra o editor do texto ou da pasta selecionada. No primeiro uso, mostra uma apresentação em três passos.
- Não há ajuda nem Sobre. O repositório não tem arquivo de licença; `tauri.conf.json` tem `"copyright": "© 2026 CSTM"`.
- Depende do plano 077, que será executado antes. A ajuda avançada já explica o histórico do clipboard, e a seção do histórico nas Configurações migra junto para a página.

## Decisões do usuário

- Sem janela nem diálogo novos. Ajuda, Sobre e Configurações aparecem na área principal.
- A ajuda básica abre sozinha uma vez.
- O Sobre mostra:
  - nome, versão e descrição;
  - o link do GitHub;
  - a pasta dos dados;
  - a licença MIT e o autor.
- Ordem: o 077 antes deste plano.

## Escopo

### Incluído

- **Páginas na área principal:** o editor dá lugar à página escolhida (Configurações, Ajuda ou Sobre). A árvore continua à esquerda e funciona normalmente.
  - Selecionar um item na árvore, criar um texto ou uma pasta, ou clicar de novo no botão da página ativa volta ao editor.
  - Os rascunhos não são afetados: o salvamento automático continua.
- **Como abrir:**
  - na barra inferior, à direita dos totais: os botões **Configurações** (engrenagem, já existe), **Ajuda** (`?`) e **Sobre** (`i`); o da página aberta fica marcado;
  - `F1` abre a Ajuda;
  - o menu da bandeja fica **Abrir cadastro**, **Configurações**, **Ajuda**, **Sobre o CSTM**, separador e **Sair**; cada item mostra a janela já na página;
  - a ação **Alterar atalho** do aviso abre a página Configurações.
- **Configurações:** mesmo conteúdo e comportamento do diálogo atual (atalho, navegação nas pastas, tema, iniciar com o Windows e histórico do clipboard), sem o botão Fechar. "Restaurar padrão (Alt+Q)" fica junto do atalho. `Esc` continua cancelando a gravação de um atalho.
- **Ajuda:** título "Ajuda" com abas (`TabList` do Fluent UI). O conteúdo fica num componente próprio e usa o atalho configurado, por exemplo "pressione Alt+Q" ou o atalho escolhido pelo usuário.
  - **Básico**, em passos curtos e numerados:
    - criar um texto (`+ Novo` → Novo texto);
    - escrever título e conteúdo (salva sozinho);
    - organizar em pastas;
    - em qualquer programa, pressionar o atalho para abrir o menu junto ao mouse;
    - clicar no texto para colá-lo, ou no botão Copiar para só copiar;
    - o CSTM continua na bandeja ao fechar a janela.
  - **Avançado**, em seções curtas:
    - busca no cadastro e no menu;
    - favoritos e Mais usados;
    - navegação pelo teclado no menu e o `Ctrl+C`;
    - histórico do clipboard;
    - organizar a árvore: arrastar, recortar e colar, seleção múltipla, ordenar;
    - lixeira;
    - importar e exportar;
    - as Configurações.
- **Primeira execução:** se a configuração `help_shown` não existe, a janela de cadastro começa na Ajuda, aba Básico, e o CSTM grava a chave. Isso vale também para quem atualiza de uma versão anterior, porque a ajuda é nova: aparece uma vez para todos. A apresentação em três passos do editor vazio continua.
- **Sobre:**
  - o ícone do aplicativo, "CSTM", "Clipboard, Snippets & Text Manager" e a versão instalada;
  - uma frase de descrição;
  - o link **github.com/marinsgabriel1997/CSTM**, que abre no navegador;
  - "Pasta dos dados", com o caminho e o botão **Abrir pasta**, que abre no Explorer;
  - "Licença MIT · © 2026 Gabriel de Marins".
- **Licença:**
  - arquivo `LICENSE` (MIT, "Copyright (c) 2026 Gabriel de Marins");
  - `"license": "MIT"` em `package.json`; `license` e `authors` em `Cargo.toml`;
  - `copyright` em `tauri.conf.json` passa a "© 2026 Gabriel de Marins".
- **Backend:**
  - comandos `open_repository` e `open_data_folder`, abrindo pelo `tauri-plugin-opener` no lado Rust; o frontend não recebe permissão para abrir URLs ou caminhos arbitrários;
  - comando `get_data_dir`;
  - itens novos no menu da bandeja e o evento de página pedida, generalizando o `settings-requested`.
- **Processo:** acrescentar ao `AGENTS.md` a regra de atualizar a Ajuda na mesma entrega sempre que uma funcionalidade, atalho ou fluxo visível ao usuário mudar.
- **Documentação:**
  - `docs/telas.md`: a Tela 3 passa a ser página, e entram as novas telas Ajuda e Sobre, com os protótipos `docs/prototipo/ajuda.html` e `docs/prototipo/sobre.html`, desenhados **antes** da implementação;
  - `docs/prototipo/configuracoes.html`, o desenho da bandeja e da barra inferior;
  - `docs/mvp.md` e `CHANGELOG.md`.

### Fora do escopo

- Tour interativo com destaques sobre a interface, vídeos ou imagens animadas.
- Ajuda online, verificação de atualizações e página de licenças de terceiros.
- Página de licença no instalador.

## Estado desejado

- Na barra inferior, engrenagem, `?` e `i` abrem as três páginas na área do editor, sem nenhuma janela sobreposta.
- Na primeira execução da nova versão, o cadastro abre na Ajuda Básica. Nas seguintes, abre normalmente.
- O menu da bandeja leva direto a Configurações, Ajuda e Sobre.
- No Sobre, o link e o botão Abrir pasta funcionam.

## Dependências

- `tauri-plugin-opener` (Rust), para abrir URL e pasta pelo backend.

## Riscos

| Risco | Mitigação |
| --- | --- |
| A ajuda ficar desatualizada | Regra no `AGENTS.md`, conteúdo num único componente e o atalho lido da configuração. |
| Atalhos de teclado do cadastro (Ctrl+N, Del, Ctrl+C/X/V) agindo com uma página aberta | Definir e testar: os comandos da árvore continuam valendo quando o foco está nela, e os campos das páginas não disparam ações da árvore. |
| Testes atuais do diálogo de Configurações | Migrar os testes para a página, preservando as expectativas de comportamento; só muda o meio de abrir e fechar. |
| Abrir a página pela bandeja com a janela oculta pela inicialização com o Windows | O evento é tratado depois de a janela ser mostrada, como o `settings-requested` faz hoje. |

## Premissas

- A versão mostrada vem de `getVersion()` do Tauri, igual à de `package.json`.
- O autor é "Gabriel de Marins", conforme o usuário do Git do repositório.

## Estratégia de validação

- **Frontend:**
  - abrir e fechar cada página pelos botões e pelo `F1`;
  - voltar ao editor ao selecionar um item;
  - ajuda na primeira execução, uma vez só;
  - abas da Ajuda e atalho configurado no texto;
  - Sobre com versão e caminho, e as chamadas de abrir;
  - os testes atuais de Configurações migrados.
- **Backend:** testes dos novos comandos e do menu da bandeja quando forem testáveis; `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check`.
- **Comandos do frontend:** `npm run test`, `npm run build` e `npm run lint`.
- **Funcional no Windows:** pelo Marco, com o instalador de teste.

## Fases

### Fase 1 — Desenho

- [x] Atualizar `docs/telas.md`: as páginas na área principal, a barra inferior, a bandeja, `F1`, a primeira execução e o conteúdo das abas.
- [x] Criar `docs/prototipo/ajuda.html` e `docs/prototipo/sobre.html` e atualizar `docs/prototipo/configuracoes.html`.

Critério: o desenho cobre as três páginas nos temas claro e escuro, a ajuda na primeira execução e a volta ao editor.

Resultado: Telas 3 (agora página), 4 (Ajuda) e 5 (Sobre) em `docs/telas.md`; protótipos conferidos em captura do Edge. O texto da Ajuda é o mesmo do protótipo e de `src/helpContent.ts`.

### Fase 2 — Licença e backend

- [x] Criar `LICENSE` e preencher os metadados em `package.json`, `Cargo.toml` e `tauri.conf.json`.
- [x] Adicionar `tauri-plugin-opener` e criar os comandos `open_repository`, `open_data_folder` e `get_data_dir`.
- [x] Adicionar os itens Ajuda e Sobre o CSTM na bandeja e o evento de página pedida.
- [x] Ler e gravar a configuração `help_shown`.

Critério: `cargo test`, clippy e fmt passam.

Resultado: passam (111 testes). O evento `settings-requested` virou `page-requested`, com a página (`settings`, `help` ou `about`); o comando `take_help_prompt` devolve se a Ajuda deve abrir e grava a chave; o link vem de `bundle.homepage`.

### Fase 3 — Páginas no cadastro

- [x] Transformar `SettingsDialog` em página, sem perder nada do comportamento atual.
- [x] Criar as páginas Ajuda (abas e conteúdo) e Sobre.
- [x] Ajustar `App.tsx`: página ativa no lugar do editor, botões da barra inferior, `F1`, bandeja, aviso de atalho e primeira execução.
- [x] Atualizar `src/api.ts` e `src/test/fakeApi.ts`, e criar e migrar os testes.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

Resultado: passam (180 testes). Os testes de Configurações foram migrados para a página (abrir pela engrenagem; sair da página durante a gravação reativa o atalho); os novos estão em `src/Pages.test.tsx`. Com uma página aberta, `Ctrl+C`/`X`/`V`/`Z` dentro dela não agem sobre os itens da árvore.

### Fase 4 — Documentação e instalador de teste

- [x] Adicionar a regra da Ajuda ao `AGENTS.md`.
- [x] Atualizar `docs/mvp.md` e o `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações automatizadas passam e o instalador de teste existe.

Resultado: `npm run test` (180), `npm run build`, `npm run lint`, `npm run test:rust` (111), `npm run lint:rust` e `cargo fmt --check` passam. Instalador: `releases/teste/CSTM_0.13.0-teste-078-20261014-1911_x64-setup.exe`.

### Fase 5 — Correção: link do repositório no Sobre

- [x] `open_repository` passa a usar a constante `REPOSITORY_URL` em `commands.rs`: `bundle.homepage` só vale ao empacotar e chega vazio em tempo de execução.
- [x] As faixas de erro do Sobre aparecem abaixo do link e do botão Abrir pasta, como no desenho.
- [x] Novo instalador de teste.

Critério: testes, lint, clippy e fmt passam e o instalador de teste existe.

Resultado: passam (180 testes do frontend, 111 do Rust). Instalador: `releases/teste/CSTM_0.13.0-teste-078-20261014-2136_x64-setup.exe`.

## Marco — Validação do usuário

- [x] Depois de instalar, o cadastro abre na Ajuda Básica uma vez; ao reabrir, abre normalmente.
- [x] Engrenagem, `?` e `i` abrem as páginas na área do editor, sem janela sobreposta, e o botão ativo fica marcado.
- [x] Clicar num item da árvore, criar um texto ou clicar de novo no botão ativo volta ao editor.
- [x] `F1` abre a Ajuda. As abas Básico e Avançado trocam o conteúdo, e o atalho citado é o configurado.
- [x] Configurações funciona como antes: atalho, navegação, tema, iniciar com o Windows e histórico.
- [x] Os itens Configurações, Ajuda e Sobre o CSTM da bandeja abrem a janela já na página certa.
- [x] No Sobre, a versão está correta, o link abre o GitHub no navegador, Abrir pasta abre a pasta dos dados no Explorer, e a licença e o autor aparecem.
- [x] O conteúdo da ajuda está claro e correto: o usuário revisa os textos das duas abas.

Resultados:

- 2026-10-14, instalador `CSTM_0.13.0-teste-078-20261014-1911`: no Sobre, o link do GitHub mostrou "Não foi possível abrir o link: o endereço do repositório não está configurado". Corrigido na fase 5. Demais verificações pendentes.
- 2026-10-14, instalador `CSTM_0.13.0-teste-078-20261014-2136`: o usuário validou a implementação.

Aceite: concedido pelo usuário em 2026-10-14.
