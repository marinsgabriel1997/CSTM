/** Tipos de `<input>` que aceitam texto e, por isso, mantêm o menu de contexto padrão. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password", "number"]);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  return target.isContentEditable;
}

/** Atalhos do navegador (recarregar, imprimir, buscar, código-fonte e DevTools) sem função no app. */
function isBrowserShortcut(event: KeyboardEvent): boolean {
  if (event.altKey) return false;
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  if (key === "f5") return !ctrl;
  if (!ctrl) return false;
  if (key === "i") return event.shiftKey;
  // Ctrl+R e Ctrl+Shift+R (recarga), Ctrl+P, Ctrl+F e Ctrl+U.
  return key === "r" || (!event.shiftKey && (key === "p" || key === "f" || key === "u"));
}

function onContextMenu(event: MouseEvent) {
  // Os menus próprios do app já chamam preventDefault no handler React; aqui só o menu do navegador é suprimido.
  if (!isEditable(event.target)) event.preventDefault();
}

function onKeyDown(event: KeyboardEvent) {
  if (isBrowserShortcut(event)) event.preventDefault();
}

/**
 * No build de release, desativa o comportamento de navegador do WebView2: o menu de contexto padrão
 * (mantido nos campos de texto) e atalhos como F5, que recarregaria a página e perderia edições pendentes.
 * Em desenvolvimento não faz nada. Retorna a função que remove os listeners.
 *
 * Os listeners só chamam `preventDefault`, sem `stopPropagation`, para não atrapalhar os handlers do app.
 * O de teclado usa captura para valer mesmo que algum componente trate a tecla antes.
 */
export function blockBrowserBehavior(): () => void {
  if (!import.meta.env.PROD) return () => {};
  window.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown, true);
  return () => {
    window.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown, true);
  };
}
