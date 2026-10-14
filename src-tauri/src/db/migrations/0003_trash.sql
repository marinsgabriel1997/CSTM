-- Lixeira: itens excluídos recebem `deleted_at` e saem de todas as listagens até serem
-- restaurados ou excluídos definitivamente. Excluir uma pasta marca só a pasta; o conteúdo
-- fica oculto por ela e volta junto ao restaurá-la.
ALTER TABLE folders ADD COLUMN deleted_at TEXT;
ALTER TABLE snippets ADD COLUMN deleted_at TEXT;

-- Pastas visíveis: fora da lixeira e sem nenhuma pasta acima delas na lixeira.
CREATE VIEW live_folders AS
WITH RECURSIVE live(id) AS (
    SELECT id FROM folders WHERE parent_id IS NULL AND deleted_at IS NULL
    UNION ALL
    SELECT f.id FROM folders f JOIN live ON f.parent_id = live.id WHERE f.deleted_at IS NULL
)
SELECT id FROM live;
