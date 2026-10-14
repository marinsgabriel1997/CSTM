import { Button, Caption1, Link, makeStyles, mergeClasses, Spinner, tokens } from "@fluentui/react-components";
import {
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Info16Regular,
  Settings16Regular,
  Warning16Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";

import type { Draft } from "../drafts";

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalXS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
  },
  status: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    paddingRight: tokens.spacingHorizontalXS,
  },
  state: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  ok: { color: tokens.colorStatusSuccessForeground1, flex: "none" },
  warning: { color: tokens.colorStatusWarningForeground1 },
  error: { color: tokens.colorStatusDangerForeground1 },
  totals: { marginLeft: "auto", flex: "none", color: tokens.colorNeutralForeground3 },
});

interface StatusBarProps {
  drafts: Draft[];
  openId: number | null;
  /** Título exibido do texto, para as mensagens. */
  titleOf: (id: number) => string;
  snippetCount: number;
  folderCount: number;
  onRetry: (id: number) => void;
  /** Abre as configurações; sem ela, o botão não aparece. */
  onOpenSettings?: () => void;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Estado do salvamento (à esquerda), totais da biblioteca e acesso às configurações (à direita). */
function StatusBar({ drafts, openId, titleOf, snippetCount, folderCount, onRetry, onOpenSettings }: StatusBarProps) {
  const styles = useStyles();
  const open = drafts.find((draft) => draft.id === openId);
  const failed = drafts.find((draft) => draft.status === "error");
  const unsaved = drafts.filter(
    (draft) =>
      draft.id !== openId &&
      (draft.status === "invalid" || (draft.status === "draft" && (draft.title.trim() || draft.content.trim()))),
  );

  let state: ReactNode;
  if (failed) {
    state = (
      <Caption1 className={mergeClasses(styles.state, styles.error)}>
        <ErrorCircle16Regular />
        Erro ao salvar “{titleOf(failed.id)}”: {failed.error}
        <Link as="button" onClick={() => onRetry(failed.id)}>
          Tentar novamente
        </Link>
      </Caption1>
    );
  } else if (drafts.some((draft) => draft.status === "saving")) {
    state = (
      <Caption1 className={styles.state}>
        <Spinner size="extra-tiny" /> Salvando…
      </Caption1>
    );
  } else if (drafts.some((draft) => draft.status === "pending")) {
    state = <Caption1 className={styles.state}>Alterações pendentes</Caption1>;
  } else if (open?.status === "draft") {
    state = (
      <Caption1 className={styles.state}>
        <Info16Regular /> Rascunho: preencha o título e o conteúdo para salvar
      </Caption1>
    );
  } else if (open?.status === "invalid") {
    const field = open.title.trim() === "" ? "o título está vazio" : "o conteúdo está vazio";
    state = (
      <Caption1 className={mergeClasses(styles.state, styles.warning)}>
        <Warning16Regular /> Não salvo: {field}. A última versão salva foi mantida.
      </Caption1>
    );
  } else if (unsaved.length > 0) {
    state = (
      <Caption1 className={mergeClasses(styles.state, styles.warning)}>
        <Warning16Regular /> {plural(unsaved.length, "texto não salvo", "textos não salvos")}: preencha título e
        conteúdo
      </Caption1>
    );
  } else if (snippetCount === 0) {
    state = <Caption1 className={styles.state}>Nenhum texto cadastrado</Caption1>;
  } else {
    state = (
      <Caption1 className={styles.state}>
        <CheckmarkCircle16Regular className={styles.ok} /> Todas as alterações salvas
      </Caption1>
    );
  }

  return (
    <footer className={styles.bar}>
      <div className={styles.status} role="status" aria-label="Estado do salvamento">
        {state}
        <Caption1 className={styles.totals}>
          {plural(snippetCount, "texto", "textos")} · {plural(folderCount, "pasta", "pastas")}
        </Caption1>
      </div>
      {onOpenSettings && (
        <Button
          appearance="subtle"
          size="small"
          aria-label="Configurações"
          title="Configurações"
          icon={<Settings16Regular />}
          onClick={onOpenSettings}
        />
      )}
    </footer>
  );
}

export default StatusBar;
