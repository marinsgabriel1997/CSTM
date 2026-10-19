# CSTM — Produto e arquitetura

## Objetivo

Cadastrar textos reutilizáveis (snippets) e colá-los rapidamente em qualquer programa
por meio de um menu flutuante aberto por atalho global. Inspiração: ClipClip.

Este documento descreve as funcionalidades do produto, o que fica fora do escopo e a arquitetura. O código e a configuração representam o estado implementado; mudanças de escopo passam por um plano em `planos/`.

## Funcionalidades

### 1. Cadastro de textos

- Criar, editar e excluir textos; excluir envia para uma lixeira, de onde os itens podem ser restaurados ou excluídos definitivamente.
- Organizar em pastas (com subpastas). Na árvore, a pasta **Raiz** (virtual, sem registro no banco) reúne as pastas e os textos sem pasta e é o destino de Novo, Colar e Importar quando selecionada; clicar no espaço vazio ou `Esc` tiram a seleção, e a criação também vai para a raiz. Novo texto e Nova pasta também estão no menu de contexto das pastas, da Raiz e do espaço vazio.
- Marcar favoritos.
- Buscar por título e conteúdo.
- Ordenação manual dentro de cada pasta, por arrastar e soltar ou pelo menu, e ordenação pontual por nome, mais usados ou uso recente.
- Operações de árvore como num gerenciador de arquivos: seleção múltipla, recortar, copiar e colar (que também duplica), desfazer (Ctrl+Z) e navegação por teclado.
- O editor mostra quantas vezes o texto foi usado e quando foi usado pela última vez.
- A janela abre, na primeira vez, proporcional à área útil do monitor (75% × 80%, entre 1000 × 650 e 1600 × 1000) e lembra posição, tamanho e maximização; uma posição salva fora das telas volta ao tamanho inicial.

### 2. Menu de colagem

- Atalho global (padrão `Alt+Q`, configurável) abre o menu junto ao cursor do mouse, dentro da área útil do monitor.
- O menu mostra as pastas virtuais Histórico (do clipboard), Mais usados (10 textos) e Favoritos, as pastas (navegáveis) e um campo de busca com foco automático.
- Navegação por teclado (setas, Enter, Esc) e mouse.
- Navegação nas pastas configurável: em cascata (padrão), o conteúdo de uma pasta abre numa coluna ao lado quando o mouse passa sobre ela ou ao clicar, como os submenus do Windows; no modo "Clicar para abrir", a lista é substituída pelo conteúdo da pasta. A busca mostra os resultados numa lista única nos dois modos.
- A janela `picker` ocupa a área útil do monitor durante a abertura, recortada em volta das colunas visíveis; no modo cascata as colunas abrem dentro dela sem redimensioná-la, sempre dentro da área útil, e o menu volta a uma coluna a cada abertura.
- Ao escolher um texto: o menu fecha, o foco volta ao programa anterior e o texto é colado. Um botão Copiar na linha selecionada (ou `Ctrl+C`) faz o mesmo sem colar, deixando o texto no clipboard.
- Títulos longos ocupam até duas linhas; a dica mostra o título completo e o conteúdo.
- Modos de colagem para textos em markdown: Markdown (como está), Sem formatação, Formatado (HTML gerado do markdown, com o texto limpo de reserva) e Google Chat (sintaxe do Chat). `Enter`, clique e Copiar usam o modo padrão das Configurações; os outros ficam em botões na linha selecionada. O conteúdo é sempre guardado como markdown, e a conversão acontece só ao colar.
- `Esc` ou clique fora fecha o menu sem colar.

### Histórico do clipboard

- O CSTM guarda os últimos 100 itens copiados em qualquer programa: textos (com a formatação HTML/RTF que vier junto) e imagens (guardadas em PNG, com miniatura). Arquivos copiados no Explorer e outros formatos ficam de fora.
- O histórico aparece no menu de colagem, na pasta virtual Histórico, do mais recente para o mais antigo; escolher um item cola no programa anterior com todos os formatos, e o botão Copiar (ou `Ctrl+C`) o deixa no clipboard. O item usado sobe para o topo; copiar de novo algo já guardado também o sobe, sem repeti-lo.
- Ligado por padrão, com a opção de desligar e o botão de limpar nas Configurações. Fica no banco e sobrevive a reinícios.
- Não guarda o que o próprio CSTM escreve no clipboard (colagem, cópia e restauração), o que os programas marcam como sensível (`ExcludeClipboardContentFromMonitorProcessing`, `Clipboard Viewer Ignore` ou `CanIncludeInClipboardHistory` igual a zero, usados por gerenciadores de senha), itens vazios nem itens acima de 10 MB.
- Nos textos do histórico, os quatro modos de colagem ficam em botões (`Enter` e Copiar colam o original). O item é lido primeiro como markdown: a formatação HTML que veio junto vira markdown e, sem ela, a sintaxe do Google Chat (`*x*`, `~x~`) também; o item guardado não muda.
- A busca principal do menu não inclui o histórico (a coluna do Histórico tem busca própria), e o cadastro continua só com textos.
- No menu, a linha selecionada do Histórico tem também um botão de lixeira (ou `Delete`, com o cursor no fim da busca), que manda o item para a Lixeira do cadastro sem fechar o menu.
- No cadastro, a pasta Histórico fica fixa no topo da árvore (some com o histórico desligado ou vazio e com a busca ou o filtro de favoritos). Um texto do histórico é editado só no conteúdo, com gravação automática; ao gravar, a formatação HTML/RTF é descartada e o item sobe para o topo. Imagens só são vistas. Excluir manda o item para a Lixeira (com Desfazer), de onde Restaurar o devolve ao lugar que tinha na ordem; na lixeira, ele não conta no limite de 100 nem é reaproveitado ao copiar o mesmo conteúdo, e "Limpar histórico" o apaga também. Itens do histórico não são copiados, movidos nem exportados como textos.

### 3. Execução em segundo plano

- Ícone na bandeja do sistema com as opções: abrir cadastro, configurações, ajuda, sobre o CSTM, sair.
- O monitor do histórico do clipboard funciona com a janela fechada.
- Fechar a janela principal apenas a oculta; o atalho continua ativo.
- Apenas uma instância do aplicativo por vez.

### 4. Configurações, Ajuda e Sobre

- Configurações, Ajuda e Sobre são páginas na área do editor do cadastro, abertas pelas linhas Ajuda, Configurações e Sobre o CSTM no rodapé do painel da árvore, abaixo da Lixeira (a Ajuda em destaque até a primeira vez que a pessoa a abre), pela bandeja e, a Ajuda, por `F1`; sem janelas nem diálogos próprios.
- Ajuda com as abas Básico (onde clicar para começar) e Avançado (demais funcionalidades), citando o atalho configurado e com imagens das telas, marcadas em vermelho e numeradas na ordem dos cliques; abre sozinha na primeira execução (configuração `help_shown`). O conteúdo fica em `src/helpContent.ts`; as imagens, em `src/assets/ajuda/`, geradas a partir dos protótipos por `npm run ajuda:imagens` (`scripts/ajuda-imagens.mjs`, ferramenta de desenvolvimento que usa o Edge sem janela).
- Sobre com versão, descrição, link do repositório, pasta dos dados (com o botão de abri-la), licença MIT e autor. O link e a pasta são abertos pelo backend (`tauri-plugin-opener`), sem permissão de abrir URLs ou caminhos arbitrários no frontend.
- Página de configurações com a troca do atalho do menu de colagem; o novo atalho vale imediatamente e é lembrado entre execuções.
- Navegação nas pastas do menu de colagem ("Abrir ao passar o mouse", padrão, ou "Clicar para abrir"); vale na próxima abertura do menu e é lembrada entre execuções.
- Tema das janelas: seguir o Windows (padrão), claro ou escuro; vale na hora e é lembrado entre execuções.
- Iniciar com o Windows (desligado por padrão): o CSTM abre só na bandeja ao entrar no Windows, com o atalho ativo. A entrada fica na chave `Run` do usuário, que é a fonte da verdade (inclusive a desativação pelo Gerenciador de Tarefas); o desinstalador a remove.
- Modo de colagem padrão (Markdown, padrão; Sem formatação; Formatado; Google Chat), usado por `Enter` e Copiar nos textos cadastrados.
- Depois de colar: manter o que foi colado na área de transferência (padrão), para colar de novo com `Ctrl+V` se a colagem falhar, ou restaurar o conteúdo anterior.
- Histórico do clipboard (ligado por padrão): desligar para de guardar na hora, sem apagar o que já foi guardado; "Limpar histórico" apaga todos os itens, com confirmação.
- Atualizações (ligada por padrão, a cada 7 dias, de 1 a 90): em segundo plano, o CSTM consulta a release mais recente na API do GitHub (`releases/latest`, sem rascunhos nem pré-releases) e, com versão nova, mostra uma notificação do Windows (uma vez por versão; o clique abre a página da release) e uma barra no topo do cadastro, que pode ser dispensada até a próxima versão. "Verificar agora" consulta na hora. É a única requisição de rede do aplicativo e envia só o `User-Agent` `CSTM/<versão>`; falhas em segundo plano são silenciosas e tentadas de novo na conferência horária; no limite de consultas da API, a próxima tentativa é reagendada para quando o GitHub indica que o limite volta (entre 1 minuto e 1 hora). A instalação continua manual, pelo instalador baixado da release.

### 5. Importação e exportação

- Importar arquivos `.txt` (um texto por arquivo, com o nome do arquivo como título), uma pasta do disco (criando a própria pasta ou só o seu conteúdo) ou um backup JSON, no destino selecionado no cadastro. A importação só cria itens novos e é feita por inteiro ou não é feita.
- Exportar a biblioteca inteira ou uma pasta como pastas com arquivos `.txt` (sem sobrescrever nada) ou como backup JSON completo (com ordem, favoritos, contador de uso e datas).
- Os `.txt` são lidos e gravados em UTF-8; arquivos em outras codificações são ignorados e informados.

## Fora do escopo

- Expansão automática por abreviação.
- Ferramentas de edição/transformação de texto.
- Variáveis em textos (data, hora, cursor).
- Linux e macOS.

## Fluxo de colagem

1. Atalho pressionado → guardar a janela ativa (`GetForegroundWindow`).
2. Exibir o menu na posição do cursor, ajustado aos limites do monitor.
3. Usuário escolhe o texto.
4. Ocultar o menu e reativar a janela guardada (`SetForegroundWindow`).
5. Com "Restaurar o conteúdo anterior", salvar o conteúdo atual do clipboard (texto com HTML e RTF, ou imagem).
6. Copiar o texto escolhido para o clipboard, convertido para o modo de colagem (no modo Formatado, HTML e texto; um item do histórico sem modo vai com todos os seus formatos), e simular `Ctrl+V` (`SendInput`).
7. Com "Restaurar o conteúdo anterior", após 500 ms, devolver o conteúdo salvo ao clipboard, se ele ainda contiver o texto colado (`GetClipboardSequenceNumber`). Com "Manter o que foi colado" (padrão), o texto colado fica no clipboard.
8. Incrementar o contador de uso do texto (um item do histórico sobe para o topo).

Antes do `Ctrl+V`, o CSTM aguarda até 1 s que as teclas modificadoras sejam soltas. Se a janela guardada não puder ser reativada, o texto apenas fica no clipboard, sem `Ctrl+V` e sem restauração. Se não havia nada que o CSTM consiga ler no clipboard (vazio, ou só arquivos copiados no Explorer), o texto colado permanece nele.

### Limitações conhecidas

- Programas executados como administrador não recebem a colagem se o CSTM não estiver elevado (UIPI); o Windows não informa a falha.
- Alguns programas podem ignorar entrada simulada (jogos, acesso remoto, certos terminais).
- Com "Restaurar o conteúdo anterior", voltam texto, HTML, RTF e imagem; arquivos copiados no Explorer e formatos próprios de outros programas se perdem.
- O histórico do clipboard fica no banco sem criptografia; o que os programas não marcam como sensível é guardado. Por isso há a opção de desligá-lo e o botão de limpar.
- A leitura da formatação HTML do histórico reconhece tags de formatação (negrito, itálico, listas, links etc.); negrito só por estilo CSS, como no Google Docs, não é reconhecido.
- Colar uma imagem do histórico depende de o programa de destino aceitar `CF_DIB` ou PNG; colar a formatação depende de ele aceitar HTML ou RTF.

## Arquitetura

### Janelas

| Janela | Função |
|---|---|
| `main` | Cadastro e organização dos textos |
| `picker` | Menu flutuante: sem bordas, transparente e sem sombra nativa (cada coluna é um cartão desenhado pela interface), sempre no topo, fora da barra de tarefas, criada oculta; a cada abertura ocupa a área útil do monitor, e o backend a recorta (região da janela) em volta das colunas visíveis, deixando o clique passar para o programa de trás fora delas |

### Backend (Rust)

| Módulo | Responsabilidade |
|---|---|
| `db` | Conexão SQLite, migrações, consultas |
| `commands` | Comandos Tauri expostos ao frontend |
| `picker` | Exibir/ocultar o menu, posicionamento, janela anterior, navegação nas pastas e recorte da janela em volta das colunas |
| `cascade` | Geometria pura das colunas do menu em cascata (posição de cada coluna e retângulos do recorte da janela), testada sem janela |
| `paste` | Fluxo de colagem e simulação de `Ctrl+V` (Windows); cópia sem colar |
| `clipboard` | Leitura e escrita do clipboard em vários formatos (texto, HTML, RTF, imagem) pela API Win32; conversão das imagens em PNG e miniatura |
| `clipboard_history` | Monitor do clipboard: janela só de mensagens com `AddClipboardFormatListener`, numa thread própria, que grava as cópias no histórico; também é a dona do clipboard nas escritas do CSTM, para que elas sejam ignoradas |
| `markdown` | Conversões dos modos de colagem (markdown para texto limpo, HTML e sintaxe do Google Chat) e leitura dos itens do histórico como markdown |
| `main_window` | Tamanho inicial, validação e memória da posição e do tamanho da janela do cadastro |
| `tray` | Ícone e menu da bandeja |
| `theme` | Tema escolhido: gravação, aviso às janelas e barra de título do cadastro |
| `autostart` | Iniciar com o Windows: entrada na chave `Run` do usuário e leitura da `StartupApproved` |
| `update` | Verificação de atualização: consulta à API de releases do GitHub, comparação de versões, conferência horária do intervalo numa thread própria, notificação do Windows e evento `update-available` para o cadastro |

### Dependências

| Dependência | Uso |
|---|---|
| `rusqlite` (feature `bundled`) | SQLite embutido |
| `rusqlite_migration` | Migrações do esquema |
| `tauri-plugin-global-shortcut` | Atalho global |
| `tauri-plugin-clipboard-manager` | Leitura e escrita de texto no clipboard fora do Windows (no Windows, o módulo `clipboard` usa a API Win32) |
| `tauri-plugin-opener` | Abrir o repositório no navegador e a pasta dos dados no Explorer (só pelo backend) |
| `image` (features `png` e `bmp`) | Conversão das imagens do clipboard em PNG e miniatura, e de volta em bitmap ao colar |
| `pulldown-cmark` | Leitura do markdown nos modos de colagem |
| `htmd` | Conversão da formatação HTML do histórico em markdown |
| `ureq` (TLS rustls) | Consulta à API de releases do GitHub na verificação de atualização |
| `tauri-plugin-single-instance` | Instância única |
| `tauri` (feature `tray-icon`) | Ícone na bandeja |
| `windows` | `GetForegroundWindow`, `SetForegroundWindow`, `SendInput`, região da janela, registro (inicialização com o Windows), clipboard (formatos, memória global e `AddClipboardFormatListener`) e notificação do Windows (WinRT `ToastNotificationManager`) |

O banco fica na pasta de dados do aplicativo (`%APPDATA%\com.gabriel.cstm\cstm.db`).
O frontend acessa os dados somente por comandos Tauri; não executa SQL.

## Modelo de dados

```sql
CREATE TABLE folders (
    id          INTEGER PRIMARY KEY,
    parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE snippets (
    id           INTEGER PRIMARY KEY,
    folder_id    INTEGER REFERENCES folders(id) ON DELETE CASCADE,  -- NULL = raiz
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL,
    favorite     INTEGER NOT NULL DEFAULT 0,
    use_count    INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);

-- Busca de texto completo sobre título e conteúdo
CREATE VIRTUAL TABLE snippets_fts USING fts5(
    title, content,
    content = 'snippets', content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2'
);
-- + gatilhos para manter snippets_fts sincronizada

-- Configurações do aplicativo (atalho, navegação nas pastas, modo de colagem padrão, tema,
-- depois de colar, histórico do clipboard, verificação de atualização e versões já avisadas ou dispensadas,
-- Ajuda já mostrada, estado da janela do cadastro); chaves ausentes usam o padrão
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Histórico do clipboard: no máximo 100 itens fora da lixeira, ordenados por position (maior primeiro)
CREATE TABLE clipboard_items (
    id         INTEGER PRIMARY KEY,
    kind       TEXT    NOT NULL,  -- 'text' ou 'image'
    text       TEXT,
    html       BLOB,              -- "HTML Format", como veio
    rtf        BLOB,              -- "Rich Text Format", como veio
    image      BLOB,              -- PNG
    thumbnail  BLOB,              -- PNG de até 64 px
    width      INTEGER,
    height     INTEGER,
    position   INTEGER NOT NULL,
    created_at TEXT    NOT NULL,
    copied_at  TEXT    NOT NULL,  -- última cópia, uso ou edição
    deleted_at TEXT               -- preenchido enquanto o item está na lixeira
);
```

## Instalador

- Formato: somente NSIS (`bundle.targets: ["nsis"]`); não há instalador MSI.
- Instalação por usuário (`installMode: "currentUser"`) em `%LOCALAPPDATA%\CSTM`, sem pedir administrador. Atalho no Menu Iniciar.
- Idioma do instalador: português do Brasil (`PortugueseBR`).
- Os dados ficam em `%APPDATA%\com.gabriel.cstm` e são sempre preservados ao reinstalar por cima e ao desinstalar; o desinstalador não oferece apagá-los. Também ficam o cache do WebView2 em `%LOCALAPPDATA%\com.gabriel.cstm` e as chaves de registro do local de instalação e do idioma do instalador. Para apagar os dados, o usuário exclui os itens e esvazia a Lixeira, usa **Limpar histórico** ou apaga a pasta depois de desinstalar.
- WebView2 no modo padrão do Tauri (baixado se ausente).
- Executar o instalador com a mesma versão já instalada oferece "Adicionar/Reinstalar componentes" ou "Desinstalar CSTM"; desinstalar por ali encerra o instalador ao fim da desinstalação. O comportamento vem do template próprio `src-tauri/windows/installer.nsi`, cópia do template do Tauri CLI 2.12.1 com as mudanças do CSTM (esta, o link da página final e a remoção da caixa "apagar os dados do aplicativo" e do bloco que apagava os dados ao desinstalar); ao atualizar o Tauri CLI, copiar o template da nova versão e reaplicá-las.
- O link do repositório (`bundle.homepage`, <https://github.com/marinsgabriel1997/CSTM>) aparece na página final do instalador ("CSTM no GitHub") e em "Aplicativos instalados" do Windows.
- Sem assinatura de código: o SmartScreen do Windows avisa ao executar o instalador.

