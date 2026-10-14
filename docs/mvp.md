# CSTM — Escopo do MVP

## Objetivo

Cadastrar textos reutilizáveis (snippets) e colá-los rapidamente em qualquer programa
por meio de um menu flutuante aberto por atalho global. Inspiração: ClipClip.

## Funcionalidades do MVP

### 1. Cadastro de textos

- Criar, editar e excluir textos.
- Organizar em pastas (com subpastas).
- Marcar favoritos.
- Buscar por título e conteúdo.
- Ordenação manual dentro de cada pasta.

### 2. Menu de colagem

- Atalho global (padrão `Alt+Q`, configurável) abre o menu junto ao cursor do mouse, dentro da área útil do monitor.
- O menu mostra favoritos, pastas (navegáveis) e um campo de busca com foco automático.
- Navegação por teclado (setas, Enter, Esc) e mouse.
- Ao escolher um texto: o menu fecha, o foco volta ao programa anterior e o texto é colado.
- `Esc` ou clique fora fecha o menu sem colar.

### 3. Execução em segundo plano

- Ícone na bandeja do sistema com as opções: abrir cadastro, configurações, sair.
- Fechar a janela principal apenas a oculta; o atalho continua ativo.
- Apenas uma instância do aplicativo por vez.

### 4. Configurações

- Tela de configurações com a troca do atalho do menu de colagem; o novo atalho vale imediatamente e é lembrado entre execuções.

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
7. Após um breve intervalo, restaurar o conteúdo anterior do clipboard.
8. Incrementar o contador de uso do texto.

### Limitações conhecidas

- Programas executados como administrador não recebem a colagem se o CSTM não estiver elevado (UIPI).
- Alguns programas podem ignorar entrada simulada (jogos, acesso remoto, certos terminais).
- Somente conteúdo de texto do clipboard é restaurado; formatos ricos anteriores podem ser perdidos.

## Arquitetura

### Janelas

| Janela | Função |
|---|---|
| `main` | Cadastro e organização dos textos |
| `picker` | Menu flutuante: sem bordas, sempre no topo, fora da barra de tarefas, criada oculta |

### Backend (Rust)

| Módulo | Responsabilidade |
|---|---|
| `db` | Conexão SQLite, migrações, consultas |
| `commands` | Comandos Tauri expostos ao frontend |
| `picker` | Exibir/ocultar o menu, posicionamento, janela anterior |
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

## Etapas

Cada etapa termina com um commit funcional.

1. **Base do projeto:** remover o exemplo do template; configurar rustfmt, clippy e ESLint.
2. **Banco de dados:** conexão, migrações e operações de pastas e textos, com testes.
3. **Tela de cadastro:** árvore de pastas, lista, editor, busca, favoritos.
4. **Segundo plano:** bandeja, instância única, fechar para a bandeja.
5. **Menu de colagem:** janela `picker`, atalho global, busca e navegação por teclado.
5b. **Configurações:** tela de configurações com a troca do atalho.
6. **Colagem:** foco na janela anterior, clipboard, `SendInput`, restauração do clipboard.
7. **Acabamento:** ícones, nome, versão, instalador.

## Decisões em aberto

- Tempo de espera antes de restaurar o clipboard (valor inicial a calibrar por testes).
