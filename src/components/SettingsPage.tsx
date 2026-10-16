import {
  Button,
  Caption1,
  Divider,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import {
  api,
  errorMessage,
  type PasteFormat,
  type PickerNavigation,
  type ShortcutStatus,
  type ThemeChoice,
} from "../api";
import { DEFAULT_SHORTCUT, recordKey, shortcutKeys, shortcutLabel, usesAltGr } from "../shortcut";
import Page from "./Page";

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
  section: { marginTop: tokens.spacingVerticalS },
  // O Switch tem margem própria; alinha o controle à esquerda, como os títulos.
  switch: { marginLeft: `calc(-1 * ${tokens.spacingHorizontalS})` },
  switchHelp: { color: tokens.colorNeutralForeground2, marginTop: `calc(-1 * ${tokens.spacingVerticalM})` },
  // Alinhados ao texto do interruptor, como a explicação.
  historyActions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  confirm: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  confirmButtons: { display: "flex", gap: tokens.spacingHorizontalS },
  danger: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": { backgroundColor: tokens.colorPaletteRedForeground1, color: tokens.colorNeutralForegroundOnBrand },
  },
  restore: { alignSelf: "flex-start", marginTop: tokens.spacingVerticalXS },
});

interface SettingsPageProps {
  /** Atalho atual; a página informa as mudanças por `onShortcutChange`. */
  shortcut: ShortcutStatus;
  onShortcutChange: (status: ShortcutStatus) => void;
}

/**
 * Página de configurações, na área do editor: o atalho do menu de colagem, a navegação nas
 * pastas dele, o tema, a inicialização com o Windows e o histórico do clipboard.
 */
function SettingsPage({ shortcut, onShortcutChange }: SettingsPageProps) {
  const styles = useStyles();
  const [recording, setRecording] = useState(false);
  // Modificadores já pressionados durante a gravação.
  const [pressed, setPressed] = useState<string[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [changed, setChanged] = useState(false);
  // Atalho recusado pelo Windows na última tentativa.
  const [refused, setRefused] = useState<string | null>(null);
  // Navegação nas pastas do menu; `null` até carregar.
  const [navigation, setNavigation] = useState<PickerNavigation | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  // Modo de colagem padrão; `null` até carregar.
  const [pasteFormat, setPasteFormat] = useState<PasteFormat | null>(null);
  const [pasteFormatError, setPasteFormatError] = useState<string | null>(null);
  // Tema e inicialização com o Windows; `null` até carregar.
  const [theme, setTheme] = useState<ThemeChoice | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  // Histórico do clipboard: opção e quantidade de itens; `null` até carregar.
  const [monitoring, setMonitoring] = useState<boolean | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  // Espelho de `recording` para os avisos de janela e a saída da página.
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

  // Sair da página no meio da gravação também reativa o atalho.
  useEffect(
    () => () => {
      if (recordingRef.current) void api.resumeShortcut().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    let current = true;
    api.getPickerNavigation().then(
      (value) => current && setNavigation(value),
      (reason) => current && setNavigationError(errorMessage(reason)),
    );
    api.getPasteFormat().then(
      (value) => current && setPasteFormat(value),
      (reason) => current && setPasteFormatError(errorMessage(reason)),
    );
    api.getTheme().then(
      (value) => current && setTheme(value),
      (reason) => current && setThemeError(errorMessage(reason)),
    );
    api.getAutostart().then(
      (value) => current && setAutostart(value),
      (reason) =>
        current && setAutostartError(`Não foi possível ler a inicialização com o Windows: ${errorMessage(reason)}`),
    );
    api.getClipboardMonitoring().then(
      (value) => current && setMonitoring(value),
      (reason) => current && setHistoryError(`Não foi possível ler o histórico do clipboard: ${errorMessage(reason)}`),
    );
    const countHistory = () =>
      api.listClipboardHistory().then(
        (items) => current && setHistoryCount(items.length),
        () => undefined,
      );
    void countHistory();
    // Cópias feitas com as Configurações abertas mudam a quantidade.
    let unlisten: (() => void) | undefined;
    api
      .onClipboardHistoryChanged(() => void countHistory())
      .then(
        (remove) => (current ? (unlisten = remove) : remove()),
        () => undefined,
      );
    return () => {
      current = false;
      unlisten?.();
    };
  }, []);

  // A escolha vale na próxima abertura do menu de colagem.
  async function changeNavigation(value: PickerNavigation) {
    setNavigationError(null);
    try {
      setNavigation(await api.setPickerNavigation(value));
    } catch (reason) {
      setNavigationError(errorMessage(reason));
    }
  }

  // A escolha vale na próxima abertura do menu de colagem.
  async function changePasteFormat(value: PasteFormat) {
    setPasteFormatError(null);
    try {
      setPasteFormat(await api.setPasteFormat(value));
    } catch (reason) {
      setPasteFormatError(errorMessage(reason));
    }
  }

  // O tema vale na hora nas duas janelas.
  async function changeTheme(value: ThemeChoice) {
    setThemeError(null);
    try {
      setTheme(await api.setTheme(value));
    } catch (reason) {
      setThemeError(errorMessage(reason));
    }
  }

  async function changeAutostart(enabled: boolean) {
    setAutostartError(null);
    try {
      setAutostart(await api.setAutostart(enabled));
    } catch (reason) {
      setAutostartError(`Não foi possível alterar a inicialização com o Windows: ${errorMessage(reason)}`);
    }
  }

  // Desligar não apaga os itens já guardados.
  async function changeMonitoring(enabled: boolean) {
    setHistoryError(null);
    try {
      setMonitoring(await api.setClipboardMonitoring(enabled));
    } catch (reason) {
      setHistoryError(`Não foi possível alterar o histórico do clipboard: ${errorMessage(reason)}`);
    }
  }

  async function clearHistory() {
    setHistoryError(null);
    setConfirmingClear(false);
    try {
      await api.clearClipboardHistory();
      setHistoryCount(0);
      setCleared(true);
    } catch (reason) {
      setHistoryError(`Não foi possível limpar o histórico: ${errorMessage(reason)}`);
    }
  }

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
    <Page title="Configurações" className={styles.body}>
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
      <Button
        className={styles.restore}
        disabled={recording || shortcut.shortcut === DEFAULT_SHORTCUT}
        onClick={() => void apply(DEFAULT_SHORTCUT)}
      >
        Restaurar padrão ({shortcutLabel(DEFAULT_SHORTCUT)})
      </Button>
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
      <Divider className={styles.section} />
      <Text id="navigation-title" className={styles.title}>
        Navegação nas pastas
      </Text>
      <Caption1 className={styles.help}>
        Como as pastas se abrem no menu de colagem. Vale a partir da próxima abertura do menu.
      </Caption1>
      <RadioGroup
        aria-labelledby="navigation-title"
        value={navigation ?? ""}
        disabled={navigation === null}
        onChange={(_, data) => void changeNavigation(data.value as PickerNavigation)}
      >
        <Radio
          value="cascade"
          label={
            <>
              Abrir ao passar o mouse <Caption1 className={styles.hint}>padrão</Caption1>
            </>
          }
        />
        <Radio value="click" label="Clicar para abrir" />
      </RadioGroup>
      {navigationError && (
        <MessageBar intent="error">
          <MessageBarBody>Não foi possível salvar a navegação nas pastas: {navigationError}</MessageBarBody>
        </MessageBar>
      )}
      <Divider className={styles.section} />
      <Text id="paste-format-title" className={styles.title}>
        Modo de colagem padrão
      </Text>
      <Caption1 className={styles.help}>
        Como Enter e Copiar colam os textos no menu de colagem. Os outros modos ficam em botões na linha selecionada.
      </Caption1>
      <RadioGroup
        aria-labelledby="paste-format-title"
        value={pasteFormat ?? ""}
        disabled={pasteFormat === null}
        onChange={(_, data) => void changePasteFormat(data.value as PasteFormat)}
      >
        <Radio
          value="markdown"
          label={
            <>
              Markdown <Caption1 className={styles.hint}>padrão</Caption1>
            </>
          }
        />
        <Radio value="plain" label="Sem formatação" />
        <Radio value="rich" label="Formatado" />
        <Radio value="chat" label="Google Chat" />
      </RadioGroup>
      {pasteFormatError && (
        <MessageBar intent="error">
          <MessageBarBody>Não foi possível salvar o modo de colagem: {pasteFormatError}</MessageBarBody>
        </MessageBar>
      )}
      <Divider className={styles.section} />
      <Text id="theme-title" className={styles.title}>
        Tema
      </Text>
      <RadioGroup
        aria-labelledby="theme-title"
        layout="horizontal"
        value={theme ?? ""}
        disabled={theme === null}
        onChange={(_, data) => void changeTheme(data.value as ThemeChoice)}
      >
        <Radio value="system" label="Seguir o Windows" />
        <Radio value="light" label="Claro" />
        <Radio value="dark" label="Escuro" />
      </RadioGroup>
      {themeError && (
        <MessageBar intent="error">
          <MessageBarBody>Não foi possível salvar o tema: {themeError}</MessageBarBody>
        </MessageBar>
      )}
      <Divider className={styles.section} />
      <Switch
        className={styles.switch}
        label="Iniciar com o Windows"
        checked={autostart ?? false}
        disabled={autostart === null && !autostartError}
        onChange={(_, data) => void changeAutostart(data.checked)}
      />
      <Caption1 className={styles.switchHelp}>Abre na bandeja ao entrar no Windows, com o atalho já ativo.</Caption1>
      {autostartError && (
        <MessageBar intent="error">
          <MessageBarBody>{autostartError}</MessageBarBody>
        </MessageBar>
      )}
      <Divider className={styles.section} />
      <Switch
        className={styles.switch}
        label="Guardar o histórico do clipboard"
        checked={monitoring ?? false}
        disabled={monitoring === null && !historyError}
        onChange={(_, data) => void changeMonitoring(data.checked)}
      />
      <Caption1 className={styles.switchHelp}>
        Guarda no computador os últimos 100 itens copiados em qualquer programa (textos, com a formatação, e
        imagens) e os mostra na pasta Histórico do menu de colagem. O que gerenciadores de senha marcam como
        sensível não é guardado.
      </Caption1>
      {confirmingClear ? (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody className={styles.confirm}>
            Apagar {historyCount === 1 ? "o item" : `os ${historyCount} itens`} do histórico? Não é possível
            desfazer.
            <div className={styles.confirmButtons}>
              <Button className={styles.danger} onClick={() => void clearHistory()}>
                Limpar
              </Button>
              <Button onClick={() => setConfirmingClear(false)}>Cancelar</Button>
            </div>
          </MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.historyActions}>
          <Button
            disabled={!historyCount}
            onClick={() => {
              setCleared(false);
              setConfirmingClear(true);
            }}
          >
            Limpar histórico
          </Button>
          {cleared && <Caption1 className={styles.success}>Histórico limpo.</Caption1>}
        </div>
      )}
      {historyError && (
        <MessageBar intent="error">
          <MessageBarBody>{historyError}</MessageBarBody>
        </MessageBar>
      )}
    </Page>
  );
}

export default SettingsPage;
