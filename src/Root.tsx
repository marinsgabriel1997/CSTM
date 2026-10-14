import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import type { ReactNode } from "react";

import { useDarkTheme } from "./theme";

interface RootProps {
  children: ReactNode;
  /** Sem fundo próprio, para janelas transparentes que desenham o próprio fundo. */
  transparent?: boolean;
}

/** Aplica o tema do Fluent UI escolhido nas Configurações (por padrão, o do Windows). */
function Root({ children, transparent }: RootProps) {
  const dark = useDarkTheme();
  return (
    <FluentProvider
      theme={dark ? webDarkTheme : webLightTheme}
      style={transparent ? { backgroundColor: "transparent" } : undefined}
    >
      {children}
    </FluentProvider>
  );
}

export default Root;
