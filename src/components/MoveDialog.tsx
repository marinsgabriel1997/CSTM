import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Radio,
  RadioGroup,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";

import type { FolderOption } from "../tree";

const ROOT = "root";

const useStyles = makeStyles({
  list: {
    maxHeight: "320px",
    overflowY: "auto",
    flexWrap: "nowrap",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXS,
  },
});

interface MoveDialogProps {
  /** Nome do item movido, para o título. */
  name: string;
  rootLabel: string;
  /** Pastas que podem receber o item. */
  options: FolderOption[];
  current: number | null;
  onMove: (folderId: number | null) => void;
  onCancel: () => void;
}

function MoveDialog({ name, rootLabel, options, current, onMove, onCancel }: MoveDialogProps) {
  const styles = useStyles();
  const [value, setValue] = useState(current === null ? ROOT : String(current));
  const destination = value === ROOT ? null : Number(value);

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open) onCancel();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Mover “{name}”</DialogTitle>
          <DialogContent>
            <RadioGroup
              aria-label="Destino"
              className={styles.list}
              value={value}
              onChange={(_, data) => setValue(data.value)}
            >
              <Radio value={ROOT} label={rootLabel} />
              {options.map((option) => (
                <Radio
                  key={option.id}
                  value={String(option.id)}
                  label={option.name}
                  style={{ paddingLeft: `${(option.depth + 1) * 20}px` }}
                />
              ))}
            </RadioGroup>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={destination === current} onClick={() => onMove(destination)}>
              Mover
            </Button>
            <Button onClick={onCancel}>Cancelar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default MoveDialog;
