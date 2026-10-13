import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

import App from "./App";
import { usePrefersDark } from "./theme";

/** Aplica o tema do Fluent UI conforme o tema claro/escuro do Windows. */
function Root() {
  const dark = usePrefersDark();
  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme}>
      <App />
    </FluentProvider>
  );
}

export default Root;
