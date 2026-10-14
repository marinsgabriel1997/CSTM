import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Toast,
  ToastBody,
  ToastTitle,
  ToastTrigger,
  tokens,
} from "@fluentui/react-components";
import { Delete20Regular, DismissRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";

import type { Notice } from "../notice";

const useStyles = makeStyles({
  danger: {
    backgroundColor: tokens.colorStatusDangerBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorStatusDangerBackground3,
      color: tokens.colorNeutralForegroundOnBrand,
      opacity: 0.9,
    },
    ":hover:active": {
      backgroundColor: tokens.colorStatusDangerBackground3,
      color: tokens.colorNeutralForegroundOnBrand,
    },
  },
  list: { margin: `${tokens.spacingVerticalXXS} 0 0`, paddingLeft: tokens.spacingHorizontalL },
  icon: { color: tokens.colorNeutralForeground2 },
});

export interface Confirmation {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** Ação destrutiva: o botão de confirmação fica em vermelho. */
  danger?: boolean;
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  confirmation: Confirmation | null;
  onCancel: () => void;
}

export function ConfirmDialog({ confirmation, onCancel }: ConfirmDialogProps) {
  const styles = useStyles();
  // Um diálogo novo a cada confirmação: reabrir a mesma instância deixava a superfície
  // marcada com `aria-hidden` pelo controle de foco do Fluent (Tabster).
  if (!confirmation) return null;
  return (
    <Dialog
      open
      modalType="alert"
      onOpenChange={(_, data) => {
        if (!data.open) onCancel();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{confirmation.title}</DialogTitle>
          <DialogContent>{confirmation.message}</DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              className={confirmation.danger ? styles.danger : undefined}
              onClick={confirmation.onConfirm}
            >
              {confirmation.confirmLabel}
            </Button>
            <Button onClick={onCancel}>Cancelar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

interface ErrorMessageProps {
  message: string;
  /** Erro (padrão) ou aviso, quando algo não impede o uso do aplicativo. */
  intent?: "error" | "warning";
  /** Ação oferecida junto da mensagem. */
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}

export function ErrorMessage({ message, intent = "error", action, onClose }: ErrorMessageProps) {
  return (
    <div role="alert">
      <MessageBar intent={intent}>
        <MessageBarBody>{message}</MessageBarBody>
        <MessageBarActions
          containerAction={
            <Button
              appearance="transparent"
              aria-label="Fechar mensagem"
              icon={<DismissRegular />}
              onClick={onClose}
            />
          }
        >
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
        </MessageBarActions>
      </MessageBar>
    </div>
  );
}

/** Conteúdo de uma notificação: título, detalhes e, se houver, a ação oferecida (que a fecha). */
export function NoticeToast({ notice }: { notice: Notice }) {
  const styles = useStyles();
  return (
    <Toast>
      <ToastTitle
        media={notice.icon === "trash" ? <Delete20Regular className={styles.icon} /> : undefined}
        action={
          <ToastTrigger>
            {notice.action ? (
              <Link onClick={notice.action.onClick}>{notice.action.label}</Link>
            ) : (
              <Button
                appearance="transparent"
                size="small"
                aria-label="Fechar notificação"
                icon={<DismissRegular />}
              />
            )}
          </ToastTrigger>
        }
      >
        {notice.title}
      </ToastTitle>
      {(notice.details || notice.items) && (
        <ToastBody>
          {notice.details}
          {notice.items && (
            <ul className={styles.list}>
              {notice.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </ToastBody>
      )}
    </Toast>
  );
}
