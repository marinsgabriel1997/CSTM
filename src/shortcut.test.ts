import { describe, expect, it } from "vitest";

import { DEFAULT_SHORTCUT, recordKey, shortcutKeys, shortcutLabel, usesAltGr } from "./shortcut";

const keys = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };

describe("exibição", () => {
  it("mostra letras, números e espaço sem o prefixo da tecla física", () => {
    expect(shortcutKeys(DEFAULT_SHORTCUT)).toEqual(["Alt", "Q"]);
    expect(shortcutLabel("Ctrl+Shift+Digit5")).toBe("Ctrl+Shift+5");
    expect(shortcutLabel("Ctrl+Alt+Space")).toBe("Ctrl+Alt+Espaço");
    expect(shortcutLabel("Ctrl+F12")).toBe("Ctrl+F12");
  });

  it("identifica atalhos que coincidem com o AltGr", () => {
    expect(usesAltGr("Ctrl+Alt+KeyV")).toBe(true);
    expect(usesAltGr("Ctrl+Shift+KeyV")).toBe(false);
    expect(usesAltGr(DEFAULT_SHORTCUT)).toBe(false);
  });
});

describe("gravação", () => {
  it("monta o atalho pela tecla física, com os modificadores na ordem fixa", () => {
    expect(recordKey({ ...keys, key: "Q", code: "KeyQ", altKey: true, shiftKey: true, ctrlKey: true })).toEqual({
      kind: "shortcut",
      shortcut: "Ctrl+Alt+Shift+KeyQ",
    });
    expect(recordKey({ ...keys, key: " ", code: "Space", ctrlKey: true })).toEqual({
      kind: "shortcut",
      shortcut: "Ctrl+Space",
    });
    // Com Shift, a tecla produz outro caractere, mas o atalho continua sendo a tecla física.
    expect(recordKey({ ...keys, key: "!", code: "Digit1", altKey: true, shiftKey: true })).toEqual({
      kind: "shortcut",
      shortcut: "Alt+Shift+Digit1",
    });
  });

  it("acompanha os modificadores enquanto a combinação é montada", () => {
    expect(recordKey({ ...keys, key: "Control", code: "ControlLeft", ctrlKey: true })).toEqual({
      kind: "modifiers",
      keys: ["Ctrl"],
    });
    expect(recordKey({ ...keys, key: "Shift", code: "ShiftLeft", ctrlKey: true, shiftKey: true })).toEqual({
      kind: "modifiers",
      keys: ["Ctrl", "Shift"],
    });
  });

  it("recusa combinações fora da regra", () => {
    expect(recordKey({ ...keys, key: "q", code: "KeyQ" })).toEqual({ kind: "invalid" });
    expect(recordKey({ ...keys, key: "Q", code: "KeyQ", shiftKey: true })).toEqual({ kind: "invalid" });
    expect(recordKey({ ...keys, key: "q", code: "KeyQ", ctrlKey: true, metaKey: true })).toEqual({ kind: "invalid" });
    expect(recordKey({ ...keys, key: "Enter", code: "Enter", ctrlKey: true })).toEqual({ kind: "invalid" });
    expect(recordKey({ ...keys, key: "F13", code: "F13", altKey: true })).toEqual({ kind: "invalid" });
  });
});
