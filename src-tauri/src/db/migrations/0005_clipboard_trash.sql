-- Lixeira do histórico do clipboard: um item excluído recebe `deleted_at` e sai da lista, do
-- limite de itens e da deduplicação até ser restaurado ou excluído definitivamente. Nulo
-- significa que o item está no histórico; preenchido, na lixeira.
ALTER TABLE clipboard_items ADD COLUMN deleted_at TEXT;
