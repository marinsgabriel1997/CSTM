import {
  Button,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  tokens,
  type PositioningVirtualElement,
} from "@fluentui/react-components";
import {
  ArrowDown20Regular,
  ArrowExportUp20Regular,
  ArrowUp20Regular,
  Braces20Regular,
  Delete20Regular,
  DocumentMultiple20Regular,
  FolderArrowRight20Regular,
  MoreHorizontal20Regular,
  Rename20Regular,
  Star20Regular,
} from "@fluentui/react-icons";
import { Fragment, type ReactElement } from "react";

import { SHORTCUTS, type ActionKey, type ItemAction } from "../actions";

const ICONS: Record<ActionKey, ReactElement> = {
  rename: <Rename20Regular />,
  move: <FolderArrowRight20Regular />,
  up: <ArrowUp20Regular />,
  down: <ArrowDown20Regular />,
  favorite: <Star20Regular />,
  exportJson: <Braces20Regular />,
  exportTxt: <DocumentMultiple20Regular />,
  delete: <Delete20Regular />,
};

// Grupos separados por divisórias, na ordem do menu.
const GROUPS: ActionKey[][] = [
  ["rename", "move"],
  ["up", "down"],
  ["favorite"],
  ["exportJson", "exportTxt"],
  ["delete"],
];

/** Grupos mostrados como submenu, pelo primeiro item, com o rótulo de quem os abre. */
const SUBMENUS: Partial<Record<ActionKey, string>> = { exportJson: "Exportar" };

const useStyles = makeStyles({
  danger: {
    color: tokens.colorStatusDangerForeground1,
    ":hover": { color: tokens.colorStatusDangerForeground1 },
  },
});

interface ItemMenuListProps {
  actions: ItemAction[];
  onAction: (key: ActionKey) => void;
}

function ItemMenuList({ actions, onAction }: ItemMenuListProps) {
  const styles = useStyles();
  const groups = GROUPS.map((keys) => actions.filter((action) => keys.includes(action.key))).filter(
    (group) => group.length > 0,
  );
  const item = (action: ItemAction) => (
    <MenuItem
      key={action.key}
      icon={ICONS[action.key]}
      secondaryContent={SHORTCUTS[action.key]}
      disabled={action.disabled}
      className={action.key === "delete" ? styles.danger : undefined}
      onClick={() => onAction(action.key)}
    >
      {action.label}
    </MenuItem>
  );
  return (
    <MenuList>
      {groups.map((group, index) => {
        const submenu = SUBMENUS[group[0].key];
        return (
          <Fragment key={group[0].key}>
            {index > 0 && <MenuDivider />}
            {submenu ? (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem icon={<ArrowExportUp20Regular />}>{submenu}</MenuItem>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>{group.map(item)}</MenuList>
                </MenuPopover>
              </Menu>
            ) : (
              group.map(item)
            )}
          </Fragment>
        );
      })}
    </MenuList>
  );
}

interface ItemMenuButtonProps extends ItemMenuListProps {
  label: string;
  className?: string;
}

/** Botão `...` que abre as ações do item. */
export function ItemMenuButton({ label, className, ...list }: ItemMenuButtonProps) {
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          size="small"
          aria-label={label}
          className={className}
          icon={<MoreHorizontal20Regular />}
          tabIndex={-1}
          // Evita que o clique também selecione a linha da árvore por baixo.
          onClick={(event) => event.stopPropagation()}
        />
      </MenuTrigger>
      <MenuPopover>
        <ItemMenuList {...list} />
      </MenuPopover>
    </Menu>
  );
}

interface ItemContextMenuProps extends ItemMenuListProps {
  /** Ponto do clique direito ou elemento da linha (menu aberto pelo teclado). */
  target: HTMLElement | PositioningVirtualElement;
  onClose: () => void;
}

/** Menu de contexto aberto pelo clique direito ou pelo teclado. */
export function ItemContextMenu({ target, onClose, ...list }: ItemContextMenuProps) {
  return (
    <Menu
      open
      positioning={{ target, position: "below", align: "start" }}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <MenuPopover>
        <ItemMenuList
          {...list}
          onAction={(key) => {
            onClose();
            list.onAction(key);
          }}
        />
      </MenuPopover>
    </Menu>
  );
}
