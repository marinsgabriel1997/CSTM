import { Button, MessageBar, MessageBarActions, MessageBarBody } from "@fluentui/react-components";

import type { AvailableUpdate } from "../api";

interface UpdateBarProps {
  update: AvailableUpdate;
  onOpenRelease: () => void;
  onDismiss: () => void;
}

/** Aviso no topo da janela de que há uma versão nova do CSTM. */
function UpdateBar({ update, onOpenRelease, onDismiss }: UpdateBarProps) {
  return (
    <MessageBar intent="info" role="region" aria-label="Atualização disponível">
      <MessageBarBody>Versão {update.version} do CSTM disponível.</MessageBarBody>
      <MessageBarActions>
        <Button onClick={onOpenRelease}>Abrir página da release</Button>
        <Button onClick={onDismiss}>Dispensar</Button>
      </MessageBarActions>
    </MessageBar>
  );
}

export default UpdateBar;
