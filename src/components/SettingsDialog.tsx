import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Text,
  tokens,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { api, type ShortcutStatus } from "../api";
import { DEFAULT_SHORTCUT, recordKey, shortcutKeys, shortcutLabel, usesAltGr } from "../shortcut";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  title: { fontWeight: tokens.fontWeightSemibold },
  help: { color: tokens.colorNeutralForeground2, marginTop: `calc(-1 * ${tokens.spacingVerticalS})` },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalXS },
  field: {
    flex: 1,
    minHeight: "36px",
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderBottomColor: tokens.colorNeutralStrokeAccessible,
    backgroundColor: tokens.colorNeutralBackground1,
    outline: "none",
  },
  recording: {
    borderBottomWidth: tokens.strokeWidthThick,
    borderBottomColor: tokens.colorCompoundBrandStroke,
  },
  placeholder: { color: tokens.colorNeutralForeground4 },
  key: {
    minWidth: "26px",
    padding: `1px ${tokens.spacingHorizontalS}`,
    textAlign: "center",
    fontFamily: "inherit",
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderBottomWidth: tokens.strokeWidthThick,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  plus: { color: tokens.colorNeutralForeground3 },
  hint: { color: tokens.colorNeutralForeground2 },
  success: { color: tokens.colorStatusSuccessForeground1 },
  actions: { justifyContent: "space-between" },
});

interface SettingsDialogProps {
  /** Atalho atual; o diálogo informa as mudanças por `onShortcutChange`. */
  shortcut: ShortcutStatus;
  onShortcutChange: (status: ShortcutStatus) => void;
  onClose: () => void;
}

/** Diálogo de configurações. Por enquanto, apenas o atalho do menu de colagem. */
function SettingsDialog({ shortcut, onShortcutChange, onClose }: SettingsDialogProps) {
  const styles = useStyles();
  const [recording, setRecording] = useState(false);
  // Modificadores já pressionados durante a gravação.
  const [pressed, setPressed] = useState<string[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [changed, setChanged] = useState(false);
  // Atalho recusado pelo Windows na última tentativa.
  const [refused, setRefused] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  // Espelho de `recording` para os avisos de janela e o fechamento do diálogo.
  const recordingRef = useRef(false);

  function stopRecording() {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    setPressed([]);
    setInvalid(false);
    void api.resumeShortcut().then(onShortcutChange, () => undefined);
  }

  // Sair da janela (ou ocultá-la) durante a gravação a encerra, reativando o atalho.
  useEffect(() => {
    if (!recording) return;
    window.addEventListener("blur", stopRecording);
    return () => window.removeEventListener("blur", stopRecording);
  });

  // Fechar o diálogo no meio da gravação também reativa o atalho.
  useEffect(
    () => () => {
      if (recordingRef.current) void api.resumeShortcut().catch(() => undefined);
    },
    [],
  );

  async function startRecording() {
    recordingRef.current = true;
    setChanged(false);
    setRefused(null);
    setInvalid(false);
    setPressed([]);
    setRecording(true);
    fieldRef.current?.focus();
    await api.suspendShortcut().catch(() => undefined);
  }

  async function apply(value: string) {
    recordingRef.current = false;
    setRecording(false);
    setPressed([]);
    setInvalid(false);
    try {
      onShortcutChange(await api.setShortcut(value));
      setChanged(true);
      setRefused(null);
    } catch {
      setChanged(false);
      setRefused(value);
      // O atalho anterior volta a valer.
      api.resumeShortcut().then(onShortcutChange, () => undefined);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      stopRecording();
      return;
    }
    const result = recordKey(event);
    if (result.kind === "modifiers") setPressed(result.keys);
    else if (result.kind === "invalid") setInvalid(true);
    else void apply(result.shortcut);
  }

  function onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (!recording) return;
    const result = recordKey(event);
    if (result.kind === "modifiers") setPressed(result.keys);
  }

  const keys = recording ? (pressed.length ? [...pressed, "…"] : []) : shortcutKeys(shortcut.shortcut);

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        // Durante a gravação, Esc pertence ao campo: cancela a gravação, não o diálogo.
        if (data.open || (recording && data.type === "escapeKeyDown")) return;
        stopRecording();
        onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label="Fechar configurações" icon={<DismissRegular />} />
              </DialogTrigger>
            }
          >
            Configurações
          </DialogTitle>
          <DialogContent className={styles.body}>
            <Text className={styles.title}>Atalho do menu de colagem</Text>
            <Caption1 className={styles.help}>Abre o menu de colagem em qualquer programa.</Caption1>
            <div className={styles.row}>
              <div
                ref={fieldRef}
                className={mergeClasses(styles.field, recording && styles.recording)}
                role="textbox"
                aria-readonly
                aria-label="Atalho"
                aria-description={recording ? "Pressione o novo atalho" : undefined}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
              >
                {keys.length === 0 ? (
                  <Text className={styles.placeholder}>Pressione o novo atalho…</Text>
                ) : (
                  keys.map((key, index) => (
                    <span key={`${index}-${key}`}>
                      {index > 0 && <span className={styles.plus}>+ </span>}
                      <kbd className={styles.key}>{key}</kbd>
                    </span>
                  ))
                )}
              </div>
              {recording ? (
                <Button onClick={stopRecording}>Cancelar</Button>
              ) : (
                <Button onClick={() => void startRecording()}>Alterar</Button>
              )}
            </div>
            {recording && (
              <Caption1 className={styles.hint}>
                {invalid
                  ? "Use Ctrl ou Alt (com Shift, se quiser) e uma letra, número, F1–F12 ou Espaço."
                  : "Esc cancela e mantém o atalho atual."}
              </Caption1>
            )}
            {changed && <Caption1 className={styles.success}>Atalho alterado.</Caption1>}
            {refused && (
              <MessageBar intent="error">
                <MessageBarBody>
                  Não foi possível usar {shortcutLabel(refused)}: outro programa pode estar usando esse atalho. O
                  atalho {shortcutLabel(shortcut.shortcut)} continua valendo.
                </MessageBarBody>
              </MessageBar>
            )}
            {!recording && usesAltGr(shortcut.shortcut) && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  Atalhos com Ctrl+Alt podem bloquear caracteres digitados com AltGr (por exemplo, AltGr+Q digita “/” no
                  teclado ABNT2).
                </MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions className={styles.actions} fluid>
            <Button
              disabled={recording || shortcut.shortcut === DEFAULT_SHORTCUT}
              onClick={() => void apply(DEFAULT_SHORTCUT)}
            >
              Restaurar padrão ({shortcutLabel(DEFAULT_SHORTCUT)})
            </Button>
            <DialogTrigger action="close">
              <Button appearance="primary">Fechar</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default SettingsDialog;
