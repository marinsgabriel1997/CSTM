import {
  Button,
  makeStyles,
  Menu,
  MenuDivider,
  MenuGroupHeader,
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
  ArrowSort20Regular,
  ArrowUp20Regular,
  Braces20Regular,
  ClipboardPaste20Regular,
  Copy20Regular,
  Cut20Regular,
  Delete20Regular,
  DocumentAdd20Regular,
  DocumentMultiple20Regular,
  FolderAdd20Regular,
  FolderArrowRight20Regular,
  History20Regular,
  MoreHorizontal20Regular,
  Rename20Regular,
  Star20Regular,
  TextSortAscending20Regular,
} from "@fluentui/react-icons";
import { Fragment, type ReactElement } from "react";

import { SHORTCUTS, type ActionKey, type ItemAction } from "../actions";

const ICONS: Record<ActionKey, ReactElement> = {
  newSnippet: <DocumentAdd20Regular />,
  newFolder: <FolderAdd20Regular />,
  cut: <Cut20Regular />,
  copy: <Copy20Regular />,
  paste: <ClipboardPaste20Regular />,
  rename: <Rename20Regular />,
  move: <FolderArrowRight20Regular />,
  up: <ArrowUp20Regular />,
  down: <ArrowDown20Regular />,
  favorite: <Star20Regular />,
  sortName: <TextSortAscending20Regular />,
  sortUses: <Star20Regular />,
  sortRecent: <History20Regular />,
  exportJson: <Braces20Regular />,
  exportTxt: <DocumentMultiple20Regular />,
  delete: <Delete20Regular />,
};

interface Submenu {
  label: string;
  icon: ReactElement;
  keys: ActionKey[];
}

// Grupos separados por divisórias, na ordem do menu; um submenu aparece pelo rótulo de quem o abre.
const GROUPS: (ActionKey | Submenu)[][] = [
  ["newSnippet", "newFolder"],
  ["cut", "copy", "paste"],
  ["rename", "move"],
  ["up", "down"],
  [
    "favorite",
    { label: "Ordenar", icon: <ArrowSort20Regular />, keys: ["sortName", "sortUses", "sortRecent"] },
    { label: "Exportar", icon: <ArrowExportUp20Regular />, keys: ["exportJson", "exportTxt"] },
  ],
  ["delete"],
];

const useStyles = makeStyles({
  danger: {
    color: tokens.colorStatusDangerForeground1,
    ":hover": { color: tokens.colorStatusDangerForeground1 },
  },
});

interface ItemMenuListProps {
  actions: ItemAction[];
  onAction: (key: ActionKey) => void;
  /** Linha no topo do menu, como "3 itens selecionados". */
  header?: string;
}

function ItemMenuList({ actions, onAction, header }: ItemMenuListProps) {
  const styles = useStyles();
  const find = (key: ActionKey) => actions.find((action) => action.key === key);
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
  const groups = GROUPS.map((entries) =>
    entries.flatMap((entry) => {
      if (typeof entry === "string") {
        const action = find(entry);
        return action ? [item(action)] : [];
      }
      const inner = entry.keys.map(find).filter((action) => action !== undefined);
      if (inner.length === 0) return [];
      return [
        <Menu key={entry.label}>
          <MenuTrigger disableButtonEnhancement>
            <MenuItem icon={entry.icon} disabled={inner.every((action) => action.disabled)}>
              {entry.label}
            </MenuItem>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>{inner.map(item)}</MenuList>
          </MenuPopover>
        </Menu>,
      ];
    }),
  ).filter((group) => group.length > 0);
  return (
    <MenuList>
      {header && <MenuGroupHeader>{header}</MenuGroupHeader>}
      {groups.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && <MenuDivider />}
          {group}
        </Fragment>
      ))}
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
