import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import type { ReactNode } from "react";

import { usePrefersDark } from "./theme";

/** Aplica o tema do Fluent UI conforme o tema claro/escuro do Windows. */
function Root({ children }: { children: ReactNode }) {
  const dark = usePrefersDark();
  return <FluentProvider theme={dark ? webDarkTheme : webLightTheme}>{children}</FluentProvider>;
}

export default Root;
