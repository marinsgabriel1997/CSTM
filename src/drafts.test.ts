import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, type Snippet } from "./api";
import { DraftStore, SAVE_DELAY_MS } from "./drafts";
import { createFakeApi } from "./test/fakeApi";

let fake: ReturnType<typeof createFakeApi>;
let store: DraftStore;

beforeEach(() => {
  vi.useFakeTimers();
  fake = createFakeApi();
  Object.assign(api, fake.api);
  store = new DraftStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Promessa resolvida por fora, para controlar quando uma gravação termina. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function existing(title = "Saudação", content = "Olá"): Promise<Snippet> {
  return fake.api.createSnippet(null, title, content);
}

describe("salvamento automático", () => {
  it("grava após a pausa na digitação, e não antes", async () => {
    const snippet = await existing();
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { content: "Olá, tudo bem?" });
    expect(store.get(snippet.id)?.status).toBe("pending");

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    expect(fake.snippets[0].content).toBe("Olá");

    await vi.advanceTimersByTimeAsync(1);
    expect(fake.snippets[0].content).toBe("Olá, tudo bem?");
    expect(store.get(snippet.id)?.status).toBe("saved");
  });

  it("recomeça a espera a cada edição", async () => {
    const snippet = await existing();
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { content: "Olá," });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100);
    store.edit(snippet.id, snippet, { content: "Olá, tudo" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100);
    expect(fake.snippets[0].content).toBe("Olá");

    await vi.advanceTimersByTimeAsync(100);
    expect(fake.snippets[0].content).toBe("Olá, tudo");
  });

  it("grava na hora com flush, sem esperar a pausa", async () => {
    const snippet = await existing();
    store.open(snippet.id);
    store.edit(snippet.id, snippet, { title: "Saudação formal" });

    await store.flush(snippet.id);

    expect(fake.snippets[0].title).toBe("Saudação formal");
  });

  it("cria o texto novo na primeira gravação válida e passa a usar o id definitivo", async () => {
    const saved = vi.fn();
    store.onSaved(saved);
    const id = store.create(null);
    store.open(id);
    expect(store.get(id)?.status).toBe("draft");

    store.edit(id, undefined, { title: "Assinatura" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fake.snippets).toHaveLength(0);

    store.edit(id, undefined, { content: "Att.," });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(fake.snippets.map((s) => [s.title, s.content])).toEqual([["Assinatura", "Att.,"]]);
    const created = fake.snippets[0];
    expect(saved).toHaveBeenCalledWith(id, expect.objectContaining({ id: created.id }));
    expect(store.resolve(id)).toBe(created.id);
    expect(store.get(id)?.status).toBe("saved");

    // Edições que ainda usem o id provisório atualizam o mesmo texto.
    store.edit(id, undefined, { content: "Atenciosamente," });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fake.snippets.map((s) => s.content)).toEqual(["Atenciosamente,"]);
  });

  it("não grava texto inválido e o preserva ao trocar de item", async () => {
    const snippet = await existing();
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { title: "  " });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(store.get(snippet.id)?.status).toBe("invalid");
    expect(fake.snippets[0].title).toBe("Saudação");

    store.open(null);
    await vi.runAllTimersAsync();
    expect(store.get(snippet.id)).toMatchObject({ status: "invalid", title: "  " });
    expect(store.hasUnsaved()).toBe(true);
  });

  it("descarta ao sair o rascunho de texto salvo e o texto novo vazio", async () => {
    const snippet = await existing();
    store.open(snippet.id);
    store.edit(snippet.id, snippet, { content: "Oi" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    const empty = store.create(null);
    store.open(empty);
    expect(store.get(snippet.id)).toBeUndefined();

    store.open(null);
    expect(store.get(empty)).toBeUndefined();
    expect(store.hasUnsaved()).toBe(false);
  });

  it("preserva o texto novo incompleto ao sair dele", async () => {
    const id = store.create(null);
    store.open(id);
    store.edit(id, undefined, { title: "Só o título" });

    store.open(null);

    expect(store.get(id)).toMatchObject({ status: "draft", title: "Só o título" });
    expect(store.hasUnsaved()).toBe(true);
  });

  it("mantém as alterações quando a gravação falha e tenta de novo pelo retry", async () => {
    const snippet = await existing();
    const update = api.updateSnippet;
    api.updateSnippet = vi.fn().mockRejectedValue("banco de dados indisponível");
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { content: "Olá!" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(store.get(snippet.id)).toMatchObject({
      status: "error",
      error: "banco de dados indisponível",
      content: "Olá!",
    });

    // O erro não é repetido sozinho: só por nova edição ou pelo retry.
    await store.flush(snippet.id);
    expect(api.updateSnippet).toHaveBeenCalledTimes(1);

    api.updateSnippet = update;
    await store.retry(snippet.id);
    expect(fake.snippets[0].content).toBe("Olá!");
    expect(store.get(snippet.id)?.status).toBe("saved");
  });

  it("uma nova edição após o erro tenta gravar de novo", async () => {
    const snippet = await existing();
    const update = api.updateSnippet;
    api.updateSnippet = vi.fn().mockRejectedValueOnce("falhou").mockImplementation(update);
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { content: "Olá!" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(store.get(snippet.id)?.status).toBe("error");

    store.edit(snippet.id, snippet, { content: "Olá!!" });
    expect(store.get(snippet.id)?.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fake.snippets[0].content).toBe("Olá!!");
  });

  it("faz uma gravação por vez e grava de novo o que mudou durante ela", async () => {
    const snippet = await existing();
    const update = api.updateSnippet;
    const first = deferred<Snippet>();
    api.updateSnippet = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(update);
    store.open(snippet.id);

    store.edit(snippet.id, snippet, { content: "Um" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(store.get(snippet.id)?.status).toBe("saving");

    store.edit(snippet.id, snippet, { content: "Dois" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(api.updateSnippet).toHaveBeenCalledTimes(1);

    first.resolve({ ...snippet, content: "Um" });
    await vi.runAllTimersAsync();

    expect(api.updateSnippet).toHaveBeenCalledTimes(2);
    expect(fake.snippets[0].content).toBe("Dois");
    expect(store.get(snippet.id)?.status).toBe("saved");
  });

  it("flushAll grava todas as pendências", async () => {
    const one = await existing("Um", "1");
    const two = await existing("Dois", "2");
    store.edit(one.id, one, { content: "1!" });
    store.edit(two.id, two, { content: "2!" });

    await store.flushAll();

    expect(fake.snippets.map((s) => s.content)).toEqual(["1!", "2!"]);
    expect(store.hasUnsaved()).toBe(false);
  });

  it("exclui o texto novo removido enquanto a primeira gravação estava em andamento", async () => {
    const create = api.createSnippet;
    const pending = deferred<Snippet>();
    api.createSnippet = vi.fn().mockReturnValueOnce(pending.promise);
    const id = store.create(null);
    store.open(id);
    store.edit(id, undefined, { title: "Título", content: "Conteúdo" });
    const flushing = store.flush(id);

    store.remove(id);
    pending.resolve(await create(null, "Título", "Conteúdo"));
    await flushing;
    await vi.runAllTimersAsync();

    expect(fake.snippets).toHaveLength(0);
  });
});
