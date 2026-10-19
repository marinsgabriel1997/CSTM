import { act } from "@testing-library/react";

// O Tabster (controle de foco do Fluent) atualiza o `aria-hidden` do restante da página 250 ms
// depois de um diálogo modal fechar. Um novo diálogo aberto nesse intervalo nasce com `aria-hidden`
// e some da árvore de acessibilidade; as pessoas não reabrem um diálogo em tão pouco tempo,
// mas os testes sim. Chamar entre dois diálogos seguidos.
export function waitForDialogSettled() {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, 300)));
}
