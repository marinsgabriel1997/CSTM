-- Histórico do clipboard: os últimos itens copiados em qualquer programa. Um texto
-- guarda também a formatação HTML/RTF que veio junto (os bytes como vieram); uma
-- imagem fica em PNG, com uma miniatura para o menu de colagem.
CREATE TABLE clipboard_items (
    id         INTEGER PRIMARY KEY,
    kind       TEXT    NOT NULL CHECK (kind IN ('text', 'image')),
    text       TEXT,
    html       BLOB,
    rtf        BLOB,
    image      BLOB,
    thumbnail  BLOB,
    width      INTEGER,
    height     INTEGER,
    -- Ordem no histórico: o maior vem primeiro. Copiar de novo ou usar o item o
    -- leva ao topo com um valor novo.
    position   INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- Última cópia ou uso, mostrada no menu.
    copied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX clipboard_items_position ON clipboard_items(position);
