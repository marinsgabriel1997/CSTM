CREATE TABLE folders (
    id          INTEGER PRIMARY KEY,
    parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX folders_parent_id ON folders(parent_id);

CREATE TABLE snippets (
    id           INTEGER PRIMARY KEY,
    folder_id    INTEGER REFERENCES folders(id) ON DELETE CASCADE,  -- NULL = raiz
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL,
    favorite     INTEGER NOT NULL DEFAULT 0,
    use_count    INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX snippets_folder_id ON snippets(folder_id);

-- Busca de texto completo sobre título e conteúdo (tabela de conteúdo externo).
CREATE VIRTUAL TABLE snippets_fts USING fts5(
    title, content,
    content = 'snippets', content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER snippets_fts_insert AFTER INSERT ON snippets BEGIN
    INSERT INTO snippets_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER snippets_fts_delete AFTER DELETE ON snippets BEGIN
    INSERT INTO snippets_fts(snippets_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
END;

-- Restrito a título e conteúdo para não reindexar a cada uso, favorito ou movimentação.
CREATE TRIGGER snippets_fts_update AFTER UPDATE OF title, content ON snippets BEGIN
    INSERT INTO snippets_fts(snippets_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
    INSERT INTO snippets_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;
