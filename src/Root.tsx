import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import type { ReactNode } from "react";

import { usePrefersDark } from "./theme";

interface RootProps {
  children: ReactNode;
  /** Sem fundo próprio, para janelas transparentes que desenham o próprio fundo. */
  transparent?: boolean;
}

/** Aplica o tema do Fluent UI conforme o tema claro/escuro do Windows. */
function Root({ children, transparent }: RootProps) {
  const dark = usePrefersDark();
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
