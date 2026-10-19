import { Button, FluentProvider, makeStyles, tokens, webLightTheme } from "@fluentui/react-components";
import { ArrowDownload16Regular } from "@fluentui/react-icons";

import type { AvailableUpdate } from "../api";

interface UpdateBarProps {
  update: AvailableUpdate;
  onOpenRelease: () => void;
  onDismiss: () => void;
}

const useStyles = makeStyles({
  // Tons fixos, iguais nos temas claro e escuro: verde médio com texto quase preto,
  // para a barra chamar a atenção.
  bar: {
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: tokens.spacingHorizontalS,
    paddingTop: "6px",
    paddingBottom: "6px",
    paddingLeft: "12px",
    paddingRight: "12px",
    backgroundColor: "#3CB043",
    color: "#06200A",
    borderBottom: "1px solid #2A8A30",
  },
  button: {
    backgroundColor: "#000000",
    color: "#FFFFFF",
    border: "1px solid #000000",
    ":hover": {
      backgroundColor: "#2B2B2B",
      color: "#FFFFFF",
      border: "1px solid #2B2B2B",
    },
    ":hover:active": {
      backgroundColor: "#3D3D3D",
      color: "#FFFFFF",
    },
  },
  text: {
    fontWeight: tokens.fontWeightSemibold,
  },
  icon: {
    display: "inline-flex",
    flexShrink: 0,
  },
});

/** Aviso no topo da janela de que há uma versão nova do CSTM. */
function UpdateBar({ update, onOpenRelease, onDismiss }: UpdateBarProps) {
  const styles = useStyles();
  return (
    // Tema claro fixo: mantém fontes e tokens do Fluent independentes do tema do aplicativo.
    <FluentProvider theme={webLightTheme} style={{ backgroundColor: "transparent" }}>
      <div className={styles.bar} role="region" aria-label="Atualização disponível">
        <ArrowDownload16Regular className={styles.icon} />
        <span className={styles.text}>Versão {update.version} do CSTM disponível.</span>
        <Button size="small" className={styles.button} onClick={onOpenRelease}>
          Abrir página da release
        </Button>
        <Button size="small" className={styles.button} onClick={onDismiss}>
          Dispensar
        </Button>
      </div>
    </FluentProvider>
  );
}

export default UpdateBar;
