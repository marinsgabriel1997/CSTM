import { describe, expect, it } from "vitest";

import { copiedAtLabel, copiedLabel } from "./clipboardHistory";

const now = new Date(2026, 9, 19, 15, 30);

describe("copiedLabel", () => {
  it("mostra a hora no mesmo dia, ontem e a data nos demais", () => {
    expect(copiedLabel(new Date(2026, 9, 19, 9, 5).toISOString(), now)).toBe("09:05");
    expect(copiedLabel(new Date(2026, 9, 18, 23, 59).toISOString(), now)).toBe("ontem");
    expect(copiedLabel(new Date(2026, 9, 10, 9, 5).toISOString(), now)).toBe("10/10");
  });
});

describe("copiedAtLabel", () => {
  it("descreve a cópia de hoje, de ontem e de outro dia", () => {
    expect(copiedAtLabel(new Date(2026, 9, 19, 9, 42).toISOString(), now)).toBe("Copiado hoje às 09:42");
    expect(copiedAtLabel(new Date(2026, 9, 18, 18, 20).toISOString(), now)).toBe("Copiado ontem às 18:20");
    expect(copiedAtLabel(new Date(2025, 11, 31, 8, 0).toISOString(), now)).toBe("Copiado em 31/12/2025 às 08:00");
  });
});
