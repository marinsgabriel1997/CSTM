# p60 — Colagem

## Objetivo

Ao escolher um texto no menu de colagem, colá-lo no programa que estava ativo quando o atalho foi pressionado e, em seguida, devolver ao clipboard o texto que estava nele antes.

## Contexto

O menu de colagem (p50) abre pelo atalho global junto ao cursor; escolher um texto chama o comando `choose_snippet`, que hoje apenas copia o conteúdo para o clipboard (`picker::deliver`) e fecha o menu. O atalho é configurável (p55). O módulo `paste` previsto em `docs/mvp.md` não existe, a janela anterior não é guardada e o contador de uso (`snippets::record_use`, já implementado e testado no p20) não é chamado. A crate `windows` 0.62 já está na árvore de dependências pelo Tauri. Corresponde à etapa 6 de `docs/mvp.md` e resolve a decisão em aberto sobre o intervalo de restauração do clipboard.

## Decisões

1. **Janela anterior:** guardada (`GetForegroundWindow`) no momento em que o atalho abre o menu, antes de mostrá-lo. Se for a própria janela de cadastro do CSTM, a colagem vai para ela.
2. **Intervalo de restauração:** 500 ms após o `Ctrl+V`, em constante no código, sem opção na interface. O valor é conservador (o espanso usa 300 ms por padrão) e será confirmado na validação manual; se algum programa testado colar o texto antigo, o valor é ajustado neste plano.
3. **Restauração protegida:** o clipboard só é restaurado se ainda contiver o texto colado pelo CSTM (verificado por `GetClipboardSequenceNumber`). Se o usuário ou outro programa copiou algo nesse intervalo, nada é sobrescrito.
4. **Clipboard sem texto antes da colagem** (vazio, imagem, arquivos): o texto colado permanece no clipboard. Formatos não textuais não são preservados (limitação já documentada).
5. **Falha ao reativar a janela anterior** (fechada, inexistente ou recusada pelo Windows): o texto fica no clipboard, sem `Ctrl+V` e sem restauração, para que o usuário cole manualmente.
6. **Teclas modificadoras:** antes do `Ctrl+V`, aguardar até 1 s que `Alt`, `Shift`, `Ctrl` e `Win` sejam soltos, para que a colagem não vire outra combinação (por exemplo, `Ctrl+Alt+V`).
7. **Contador de uso:** incrementado quando o `Ctrl+V` é enviado. Não muda nenhuma ordenação nem a interface.
8. **Execução:** a sequência roda fora da thread principal (comando assíncrono), e colagens seguidas são serializadas para que uma não restaure o clipboard no meio da outra.

## Escopo

- Dependência `windows` 0.62 (somente Windows), com as features necessárias para `GetForegroundWindow`, `SetForegroundWindow`, `IsWindow`, `GetAsyncKeyState`, `SendInput` e `GetClipboardSequenceNumber`.
- Módulo `paste` no backend: reativar a janela, aguardar o foco e as modificadoras, salvar o texto do clipboard, escrever o texto escolhido, enviar `Ctrl+V`, restaurar após o intervalo. A decisão de restaurar é uma função pura com testes.
- `picker`: guardar a janela anterior em `show`; `deliver` é substituído pelo `paste`, que também fecha o menu.
- `choose_snippet` assíncrono e com registro de uso.
- Fora do Windows, o comportamento atual (apenas copiar) é mantido para que o projeto continue compilando.
- Frontend: sem mudança de interface. O erro já exibido pelo menu em falha de `choose_snippet` continua valendo.
- Documentação: `docs/mvp.md` (fluxo e decisão resolvida), `docs/telas.md` (remover a nota "no p50: copia"), `AGENTS.md` (decisão em aberto resolvida), `README.md` e `CHANGELOG.md`.

Fora do escopo: preservar formatos não textuais do clipboard; colar em programas elevados sem elevar o CSTM; intervalo configurável; ordenação por uso.

## Estado desejado

1. Com o cursor num campo de texto de outro programa, atalho → escolher um texto → o texto aparece no campo, e o menu fecha.
2. Após a colagem, `Ctrl+V` manual cola o que estava no clipboard antes.
3. Copiar algo logo após a colagem (dentro de 500 ms) não é sobrescrito pela restauração.
4. Com o clipboard contendo uma imagem antes, a colagem funciona e o texto colado permanece no clipboard.
5. Se o programa anterior foi fechado com o menu aberto, escolher um texto o deixa no clipboard, sem erro.
6. O contador de uso do texto aumenta a cada colagem.
7. `Esc`, clique fora e o atalho com o menu aberto continuam fechando sem colar.

## Premissas

- Enquanto o menu está em primeiro plano, o processo do CSTM tem permissão do Windows para chamar `SetForegroundWindow` na janela anterior.
- Os programas de destino leem o clipboard em até 500 ms após receber `Ctrl+V`.

## Riscos

- UIPI: programas executados como administrador não recebem a colagem e o Windows não informa a falha; o clipboard é restaurado e o texto não é colado. Limitação documentada.
- Programas que ignoram entrada simulada (jogos, acesso remoto, alguns terminais) não colam.
- Programas lentos podem ler o clipboard depois da restauração e colar o texto anterior; mitigado pelo intervalo conservador e pela validação manual.
- Copiar de programas com formatação (Word, navegador) e depois colar pelo CSTM perde a formatação do conteúdo anterior; apenas o texto é restaurado.

## Estratégia de validação

- `cargo test` para a decisão de restauração; `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`, `cargo build`.
- `npm run test`, `npm run build` e `npm run lint` para garantir que o frontend não mudou de comportamento.
- Validação manual no Windows dos itens do estado desejado em: Bloco de Notas, navegador (Chrome ou Edge), VS Code, Word (se disponível) e Terminal do Windows.

## Fases

### Fase 1 — Módulo de colagem

- [x] Adicionar a dependência `windows` e criar o módulo `paste`, com testes da decisão de restauração.
- [x] Guardar a janela anterior ao abrir o menu e substituir `picker::deliver` pelo `paste`.
- [x] Tornar `choose_snippet` assíncrono, serializado e com registro de uso.

Critério: `cargo build`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check`, `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 2 — Validação no Windows

- [x] Validar manualmente os itens do estado desejado nos programas listados e ajustar o intervalo, se necessário.

Critério: validação aprovada pelo usuário.

Validação aprovada com o intervalo de 500 ms. Os itens 3 e 5 do estado desejado não são reproduzíveis manualmente: copiar algo em menos de 500 ms não é viável à mão, e o menu fecha ao perder o foco, o que impede fechar o programa anterior com ele aberto. O item 3 é coberto pelos testes da decisão de restauração; o item 5, pela verificação `IsWindow` antes de reativar a janela.

### Fase 3 — Documentação

- [x] Atualizar `docs/mvp.md`, `docs/telas.md`, `AGENTS.md`, `README.md` e `CHANGELOG.md`.

Critério: documentação coerente com o comportamento implementado.
