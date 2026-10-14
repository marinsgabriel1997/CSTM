// Atalho do menu de colagem. O backend grava e valida o atalho no formato do plugin de
// atalhos globais, pela tecla física (`Alt+KeyQ`); aqui ele é exibido (`Alt+Q`) e
// montado a partir das teclas pressionadas, com a mesma regra do backend.

export const DEFAULT_SHORTCUT = "Alt+KeyQ";

/** Teclas do atalho como exibidas, por exemplo `["Ctrl", "Shift", "Espaço"]`. */
export function shortcutKeys(shortcut: string): string[] {
  return shortcut.split("+").map((part) => {
    if (part === "Space") return "Espaço";
    return part.replace(/^Key(?=[A-Z]$)/, "").replace(/^Digit(?=\d$)/, "");
  });
}

export function shortcutLabel(shortcut: string): string {
  return shortcutKeys(shortcut).join("+");
}

/** Atalhos com `Ctrl+Alt` coincidem com o AltGr dos teclados que o usam. */
export function usesAltGr(shortcut: string): boolean {
  const parts = shortcut.split("+");
  return parts.includes("Ctrl") && parts.includes("Alt");
}

/** Tecla física aceita como tecla principal: letras, números, F1–F12 e espaço. */
function isAllowedKey(code: string): boolean {
  return /^(Key[A-Z]|Digit\d|F([1-9]|1[0-2])|Space)$/.test(code);
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

/** Interpretação de uma tecla pressionada durante a gravação do atalho. */
export type Recorded =
  /** Só modificadores até agora, para exibir enquanto a combinação é montada. */
  | { kind: "modifiers"; keys: string[] }
  | { kind: "shortcut"; shortcut: string }
  | { kind: "invalid" };

export function recordKey(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): Recorded {
  const modifiers = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift"].filter(
    (name): name is string => Boolean(name),
  );
  if (MODIFIER_KEYS.has(event.key)) return { kind: "modifiers", keys: modifiers };
  if (!isAllowedKey(event.code) || event.metaKey || !(event.ctrlKey || event.altKey)) return { kind: "invalid" };
  return { kind: "shortcut", shortcut: [...modifiers, event.code].join("+") };
}
