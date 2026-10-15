import { makeStyles, Subtitle2, Tab, TabList, Text, tokens } from "@fluentui/react-components";
import { Fragment, useState, type ReactNode } from "react";

import { ADVANCED_SECTIONS, BASIC_STEPS, HELP_INTRO } from "../helpContent";
import Page from "./Page";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL },
  intro: { display: "block", marginBottom: tokens.spacingVerticalM },
  steps: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  step: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-start" },
  number: {
    flex: "none",
    width: "24px",
    height: "24px",
    display: "grid",
    placeItems: "center",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepTitle: { display: "block", fontWeight: tokens.fontWeightSemibold },
  section: { marginBottom: tokens.spacingVerticalL },
  sectionTitle: { display: "block", marginBottom: tokens.spacingVerticalXS },
  paragraph: { display: "block", marginBottom: tokens.spacingVerticalS, color: tokens.colorNeutralForeground2 },
  key: {
    padding: `1px ${tokens.spacingHorizontalXS}`,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderBottomWidth: tokens.strokeWidthThick,
    backgroundColor: tokens.colorNeutralBackground3,
  },
});

type HelpTab = "basic" | "advanced";

/** Converte a marcação dos textos (negrito, tecla e {atalho}) em elementos React, sem HTML bruto. */
function Marked({ text, shortcut, keyClass }: { text: string; shortcut: string; keyClass: string }) {
  const parts = text.replace(/{atalho}/g, shortcut).split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`")) {
          return (
            <kbd key={index} className={keyClass}>
              {part.slice(1, -1)}
            </kbd>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

interface HelpPageProps {
  /** Atalho do menu de colagem, já formatado para exibição. */
  shortcut: string;
}

/** Página Ajuda: aba Básico (primeiros passos) e aba Avançado (demais funcionalidades). */
function HelpPage({ shortcut }: HelpPageProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<HelpTab>("basic");
  const marked = (text: string): ReactNode => <Marked text={text} shortcut={shortcut} keyClass={styles.key} />;

  return (
    <Page title="Ajuda">
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as HelpTab)}>
        <Tab value="basic">Básico</Tab>
        <Tab value="advanced">Avançado</Tab>
      </TabList>
      {tab === "basic" ? (
        <div role="tabpanel" aria-label="Básico">
          <Text className={styles.intro}>{HELP_INTRO}</Text>
          <ol className={styles.steps}>
            {BASIC_STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.number} aria-hidden>
                  {index + 1}
                </span>
                <div>
                  <Text className={styles.stepTitle}>{step.title}</Text>
                  <Text>{marked(step.text)}</Text>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Avançado">
          {ADVANCED_SECTIONS.map((section) => (
            <section key={section.title} className={styles.section}>
              <Subtitle2 as="h2" className={styles.sectionTitle}>
                {section.title}
              </Subtitle2>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} className={styles.paragraph}>
                  {marked(paragraph)}
                </Text>
              ))}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

export default HelpPage;
