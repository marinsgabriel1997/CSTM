import {
  Body1,
  Button,
  Caption1,
  Divider,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Text,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";

import icon from "../../src-tauri/icons/128x128.png";
import { api, errorMessage } from "../api";
import Page from "./Page";

const useStyles = makeStyles({
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalL },
  icon: { width: "64px", height: "64px" },
  subtitle: { display: "block", color: tokens.colorNeutralForeground2 },
  description: { display: "block", marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginTop: tokens.spacingVerticalM },
  heading: { fontWeight: tokens.fontWeightSemibold },
  folder: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM },
  path: {
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  footer: { display: "block", marginTop: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
});

/** Página Sobre o CSTM: versão, código-fonte, pasta dos dados e licença. */
function AboutPage() {
  const styles = useStyles();
  // `null` até carregar (ou fora do Tauri).
  const [version, setVersion] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);
  // Erro de abrir o link ou a pasta, com a seção onde a faixa deve aparecer.
  const [error, setError] = useState<{ section: "link" | "folder"; message: string } | null>(null);

  useEffect(() => {
    let current = true;
    api.getVersion().then(
      (value) => current && setVersion(value),
      () => undefined,
    );
    api.getDataDir().then(
      (value) => current && setDataDir(value),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);

  async function open(action: () => Promise<void>, failure: string, section: "link" | "folder") {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError({ section, message: `${failure}: ${errorMessage(reason)}` });
    }
  }

  return (
    <Page title="Sobre o CSTM" hideTitle>
      <div className={styles.head}>
        <img src={icon} alt="" className={styles.icon} />
        <div>
          <Title1 as="h1">CSTM</Title1>
          <Caption1 className={styles.subtitle}>
            Clipboard, Snippets &amp; Text Manager{version && ` · versão ${version}`}
          </Caption1>
        </div>
      </div>
      <Body1 className={styles.description}>
        Salve textos para reutilizar rapidamente em qualquer programa, organize-os em pastas e cole-os pelo menu de
        colagem, sem precisar ficar copiando do Bloco de Notas. O CSTM também guarda o histórico do que você copia.
      </Body1>
      <Divider />
      <div className={styles.section}>
        <Text className={styles.heading}>Código-fonte</Text>
        <div>
          <Link as="button" onClick={() => void open(api.openRepository, "Não foi possível abrir o link", "link")}>
            github.com/marinsgabriel1997/CSTM
          </Link>
        </div>
        {error?.section === "link" && (
          <MessageBar intent="error">
            <MessageBarBody>{error.message}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <div className={styles.section}>
        <Text className={styles.heading}>Pasta dos dados</Text>
        <div className={styles.folder}>
          <Text className={styles.path}>{dataDir}</Text>
          <Button onClick={() => void open(api.openDataFolder, "Não foi possível abrir a pasta", "folder")}>
            Abrir pasta
          </Button>
        </div>
        {error?.section === "folder" && (
          <MessageBar intent="error">
            <MessageBarBody>{error.message}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <Caption1 className={styles.footer}>Licença MIT · © 2026 Gabriel de Marins</Caption1>
    </Page>
  );
}

export default AboutPage;
