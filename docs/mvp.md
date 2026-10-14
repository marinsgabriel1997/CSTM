# CSTM — Escopo do MVP

## Objetivo

Cadastrar textos reutilizáveis (snippets) e colá-los rapidamente em qualquer programa
por meio de um menu flutuante aberto por atalho global. Inspiração: ClipClip.

## Funcionalidades do MVP

### 1. Cadastro de textos

- Criar, editar e excluir textos; excluir envia para uma lixeira, de onde os itens podem ser restaurados ou excluídos definitivamente.
- Organizar em pastas (com subpastas).
- Marcar favoritos.
- Buscar por título e conteúdo.
- Ordenação manual dentro de cada pasta, por arrastar e soltar ou pelo menu, e ordenação pontual por nome, mais usados ou uso recente.
- Operações de árvore como num gerenciador de arquivos: seleção múltipla, recortar, copiar e colar (que também duplica), desfazer (Ctrl+Z) e navegação por teclado.
- O editor mostra quantas vezes o texto foi usado e quando foi usado pela última vez.

### 2. Menu de colagem

- Atalho global (padrão `Alt+Q`, configurável) abre o menu junto ao cursor do mouse, dentro da área útil do monitor.
- O menu mostra as pastas virtuais Mais usados (10 textos) e Favoritos, as pastas (navegáveis) e um campo de busca com foco automático.
- Navegação por teclado (setas, Enter, Esc) e mouse.
- Navegação nas pastas configurável: em cascata (padrão), o conteúdo de uma pasta abre numa coluna ao lado quando o mouse passa sobre ela ou ao clicar, como os submenus do Windows; no modo "Clicar para abrir", a lista é substituída pelo conteúdo da pasta. A busca mostra os resultados numa lista única nos dois modos.
- No modo cascata, a janela `picker` cresce para conter as colunas abertas, sempre dentro da área útil do monitor, e volta a uma coluna a cada abertura.
- Ao escolher um texto: o menu fecha, o foco volta ao programa anterior e o texto é colado.
- `Esc` ou clique fora fecha o menu sem colar.

### 3. Execução em segundo plano

- Ícone na bandeja do sistema com as opções: abrir cadastro, configurações, sair.
- Fechar a janela principal apenas a oculta; o atalho continua ativo.
- Apenas uma instância do aplicativo por vez.

### 4. Configurações

- Tela de configurações com a troca do atalho do menu de colagem; o novo atalho vale imediatamente e é lembrado entre execuções.
- Navegação nas pastas do menu de colagem ("Abrir ao passar o mouse", padrão, ou "Clicar para abrir"); vale na próxima abertura do menu e é lembrada entre execuções.

### 5. Importação e exportação

- Importar arquivos `.txt` (um texto por arquivo, com o nome do arquivo como título), uma pasta do disco (criando a própria pasta ou só o seu conteúdo) ou um backup JSON, no destino selecionado no cadastro. A importação só cria itens novos e é feita por inteiro ou não é feita.
- Exportar a biblioteca inteira ou uma pasta como pastas com arquivos `.txt` (sem sobrescrever nada) ou como backup JSON completo (com ordem, favoritos, contador de uso e datas).
- Os `.txt` são lidos e gravados em UTF-8; arquivos em outras codificações são ignorados e informados.

## Fora do escopo do MVP

- Histórico do clipboard.
- Expansão automática por abreviação.
- Ferramentas de edição/transformação de texto.
- Variáveis em textos (data, hora, cursor).
- Iniciar com o Windows.
- Linux e macOS.

## Fluxo de colagem

1. Atalho pressionado → guardar a janela ativa (`GetForegroundWindow`).
2. Exibir o menu na posição do cursor, ajustado aos limites do monitor.
3. Usuário escolhe o texto.
4. Ocultar o menu e reativar a janela guardada (`SetForegroundWindow`).
5. Salvar o conteúdo atual do clipboard (somente texto).
6. Copiar o texto escolhido para o clipboard e simular `Ctrl+V` (`SendInput`).
7. Após 500 ms, restaurar o texto anterior do clipboard, se o clipboard ainda contiver o texto colado (`GetClipboardSequenceNumber`).
8. Incrementar o contador de uso do texto.

Antes do `Ctrl+V`, o CSTM aguarda até 1 s que as teclas modificadoras sejam soltas. Se a janela guardada não puder ser reativada, o texto apenas fica no clipboard, sem `Ctrl+V` e sem restauração. Se o clipboard não tinha texto antes, o texto colado permanece nele.

### Limitações conhecidas

- Programas executados como administrador não recebem a colagem se o CSTM não estiver elevado (UIPI); o Windows não informa a falha.
- Alguns programas podem ignorar entrada simulada (jogos, acesso remoto, certos terminais).
- Somente conteúdo de texto do clipboard é restaurado; formatos ricos anteriores podem ser perdidos.

## Arquitetura

### Janelas

| Janela | Função |
|---|---|
| `main` | Cadastro e organização dos textos |
| `picker` | Menu flutuante: sem bordas, transparente e sem sombra nativa (cada coluna é um cartão desenhado pela interface), sempre no topo, fora da barra de tarefas, criada oculta; no modo cascata é redimensionada e movida pelo backend para conter as colunas abertas |

### Backend (Rust)

| Módulo | Responsabilidade |
|---|---|
| `db` | Conexão SQLite, migrações, consultas |
| `commands` | Comandos Tauri expostos ao frontend |
| `picker` | Exibir/ocultar o menu, posicionamento, janela anterior, navegação nas pastas e posicionamento da janela em cascata |
| `cascade` | Geometria pura das colunas do menu em cascata (posição de cada coluna e retângulo da janela), testada sem janela |
| `paste` | Clipboard e simulação de `Ctrl+V` (Windows) |
| `tray` | Ícone e menu da bandeja |

### Dependências previstas

| Dependência | Uso |
|---|---|
| `rusqlite` (feature `bundled`) | SQLite embutido |
| `rusqlite_migration` | Migrações do esquema |
| `tauri-plugin-global-shortcut` | Atalho global |
| `tauri-plugin-clipboard-manager` | Leitura e escrita do clipboard |
| `tauri-plugin-single-instance` | Instância única |
| `tauri` (feature `tray-icon`) | Ícone na bandeja |
| `windows` | `GetForegroundWindow`, `SetForegroundWindow`, `SendInput` |

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

-- Configurações do aplicativo (por exemplo, o atalho); chaves ausentes usam o padrão
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## Instalador

- Formato: somente NSIS (`bundle.targets: ["nsis"]`); não há instalador MSI.
- Instalação por usuário (`installMode: "currentUser"`) em `%LOCALAPPDATA%\CSTM`, sem pedir administrador. Atalho no Menu Iniciar.
- Idioma do instalador: português do Brasil (`PortugueseBR`).
- Os dados ficam em `%APPDATA%\com.gabriel.cstm` e são preservados ao reinstalar por cima e ao desinstalar, a menos que o usuário marque a opção do desinstalador de apagar os dados do aplicativo (desmarcada por padrão), que remove `%APPDATA%\com.gabriel.cstm` e `%LOCALAPPDATA%\com.gabriel.cstm`.
- WebView2 no modo padrão do Tauri (baixado se ausente).
- Executar o instalador com a mesma versão já instalada oferece "Adicionar/Reinstalar componentes" ou "Desinstalar CSTM"; desinstalar por ali encerra o instalador ao fim da desinstalação. O comportamento vem do template próprio `src-tauri/windows/installer.nsi`, cópia do template do Tauri CLI 2.12.1 com essa única mudança; ao atualizar o Tauri CLI, copiar o template da nova versão e reaplicá-la.
- Sem assinatura de código: o SmartScreen do Windows avisa ao executar o instalador.

## Etapas

Cada etapa termina com um commit funcional.

1. **Base do projeto:** remover o exemplo do template; configurar rustfmt, clippy e ESLint.
2. **Banco de dados:** conexão, migrações e operações de pastas e textos, com testes.
3. **Tela de cadastro:** árvore de pastas, lista, editor, busca, favoritos.
4. **Segundo plano:** bandeja, instância única, fechar para a bandeja.
5. **Menu de colagem:** janela `picker`, atalho global, busca e navegação por teclado.
5b. **Configurações:** tela de configurações com a troca do atalho.
5c. **Menu em cascata:** colunas de pastas ao passar o mouse, janela transparente e opção de navegação nas Configurações.
6. **Colagem:** foco na janela anterior, clipboard, `SendInput`, restauração do clipboard.
7. **Acabamento:** ícone, metadados do executável, instalador NSIS e bloqueio do comportamento de navegador (menu de contexto e atalhos como F5) no build de release.
