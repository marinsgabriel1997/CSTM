import { useEffect, useState, useSyncExternalStore } from "react";

import { api, type ThemeChoice } from "./api";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Acompanha o tema claro/escuro do Windows, inclusive quando ele muda com o aplicativo aberto. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches);
}

/** Tema escolhido nas Configurações, atualizado na hora quando muda em qualquer janela. */
export function useThemeChoice(): ThemeChoice {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    api.getTheme().then(
      (value) => !disposed && setChoice(value),
      // Sem o backend (frontend no navegador), segue o Windows.
      () => undefined,
    );
    api.onThemeChanged((value) => setChoice(value)).then(
      (remove) => (disposed ? remove() : (unlisten = remove)),
      () => undefined,
    );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  return choice;
}

/** Se as janelas devem usar o tema escuro, conforme a escolha e o tema do Windows. */
export function useDarkTheme(): boolean {
  const choice = useThemeChoice();
  const prefersDark = usePrefersDark();
  return choice === "system" ? prefersDark : choice === "dark";
}
