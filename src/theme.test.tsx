import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { api } from "./api";
import { createFakeApi } from "./test/fakeApi";
import { useDarkTheme } from "./theme";

let fake: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  fake = createFakeApi();
  Object.assign(api, fake.api);
});

// No jsdom do setup, o Windows está no tema claro.
it("segue o Windows enquanto nada foi escolhido", () => {
  const { result } = renderHook(() => useDarkTheme());
  expect(result.current).toBe(false);
});

it("aplica o tema gravado e troca na hora quando outra janela o muda", async () => {
  await fake.api.setTheme("dark");
  const { result } = renderHook(() => useDarkTheme());
  await waitFor(() => expect(result.current).toBe(true));

  await act(() => fake.api.setTheme("light"));
  expect(result.current).toBe(false);

  await act(() => fake.api.setTheme("dark"));
  expect(result.current).toBe(true);
});
