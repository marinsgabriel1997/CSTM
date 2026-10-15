import { makeStyles, mergeClasses, Title3, tokens } from "@fluentui/react-components";
import type { ReactNode, Ref } from "react";

const useStyles = makeStyles({
  // Ocupa a área do editor e rola quando o conteúdo não cabe na altura da janela.
  page: { flex: 1, minHeight: 0, overflowY: "auto" },
  content: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "640px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXXL}`,
  },
  title: { marginBottom: tokens.spacingVerticalL },
});

interface PageProps {
  title: string;
  /** Nome acessível da página; o título, se omitido. */
  label?: string;
  /** Sem o título visível (a página mostra o próprio cabeçalho). */
  hideTitle?: boolean;
  className?: string;
  pageRef?: Ref<HTMLElement>;
  children: ReactNode;
}

/** Página na área do editor do cadastro: Configurações, Ajuda ou Sobre. */
function Page({ title, label, hideTitle, className, pageRef, children }: PageProps) {
  const styles = useStyles();
  return (
    <section ref={pageRef} className={styles.page} aria-label={label ?? title}>
      <div className={mergeClasses(styles.content, className)}>
        {!hideTitle && (
          <Title3 as="h1" className={styles.title}>
            {title}
          </Title3>
        )}
        {children}
      </div>
    </section>
  );
}

export default Page;
