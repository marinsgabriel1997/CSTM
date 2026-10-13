import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// O jsdom não implementa `matchMedia`, usado pelo tema e pelas animações do Fluent UI.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Também ausente no jsdom; o Fluent UI o usa para posicionar tooltips e popovers.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
