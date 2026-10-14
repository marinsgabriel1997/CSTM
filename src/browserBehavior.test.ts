import { afterEach, describe, expect, it, vi } from "vitest";

import { blockBrowserBehavior } from "./browserBehavior";

let cleanup: () => void = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

function install(prod: boolean) {
  vi.stubEnv("PROD", prod);
  cleanup = blockBrowserBehavior();
}

function contextMenu(target: HTMLElement) {
  document.body.append(target);
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("release", () => {
  it("bloqueia o menu de contexto padrão fora de campos editáveis", () => {
    install(true);
    expect(contextMenu(document.createElement("div"))).toBe(true);
  });

  it("mantém o menu de contexto em campos editáveis", () => {
    install(true);
    expect(contextMenu(document.createElement("input"))).toBe(false);
    expect(contextMenu(document.createElement("textarea"))).toBe(false);
    const editable = document.createElement("div");
    // O jsdom não calcula isContentEditable a partir do atributo.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(contextMenu(editable)).toBe(false);
  });

  it("bloqueia os atalhos de navegador", () => {
    install(true);
    expect(press("F5")).toBe(true);
    expect(press("r", { ctrlKey: true })).toBe(true);
    expect(press("R", { ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press("p", { ctrlKey: true })).toBe(true);
    expect(press("f", { ctrlKey: true })).toBe(true);
    expect(press("u", { ctrlKey: true })).toBe(true);
    expect(press("I", { ctrlKey: true, shiftKey: true })).toBe(true);
  });

  it("deixa passar os atalhos do app", () => {
    install(true);
    expect(press("n", { ctrlKey: true })).toBe(false);
    expect(press("N", { ctrlKey: true, shiftKey: true })).toBe(false);
    expect(press("s", { ctrlKey: true })).toBe(false);
    expect(press("a", { ctrlKey: true })).toBe(false);
    expect(press("x", { ctrlKey: true })).toBe(false);
    expect(press("c", { ctrlKey: true })).toBe(false);
    expect(press("v", { ctrlKey: true })).toBe(false);
    expect(press("z", { ctrlKey: true })).toBe(false);
    expect(press("F2")).toBe(false);
    expect(press("Delete")).toBe(false);
  });

  it("não impede o handler do app de receber o evento", () => {
    install(true);
    const handler = vi.fn();
    document.body.addEventListener("keydown", handler);
    press("F5");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("remove os listeners na limpeza", () => {
    install(true);
    cleanup();
    expect(press("F5")).toBe(false);
    expect(contextMenu(document.createElement("div"))).toBe(false);
  });
});

describe("desenvolvimento", () => {
  it("não bloqueia nada", () => {
    install(false);
    expect(contextMenu(document.createElement("div"))).toBe(false);
    expect(press("F5")).toBe(false);
    expect(press("r", { ctrlKey: true })).toBe(false);
  });
});
