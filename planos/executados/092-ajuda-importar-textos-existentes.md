# 092 — Ajuda: importar os textos que a pessoa já tem

- **Status:** Concluído
- **Prioridade:** Média
- **Criado em:** 2026-10-20
- **Concluído em:** 2026-10-20

## Objetivo

Quem já guarda textos em pastas do Windows ou em arquivos .txt deve descobrir, logo ao abrir a Ajuda, que pode importá-los, e chegar com um clique à explicação de como importar.

## Contexto

- A aba Básico da Ajuda (`src/components/HelpPage.tsx`, textos em `src/helpContent.ts`) começa pela introdução (`HELP_INTRO`) e segue com seis passos; não fala de importação.
- A importação está na aba Avançado, seção "Importar e exportar", com um parágrafo curto. O menu **⋯** › **Importar** oferece **Arquivos .txt…**, **Pasta…**, **Conteúdo de uma pasta…** e **Backup JSON…**. Uma pasta importada traz as subpastas como pastas e cada .txt como um texto com o nome do arquivo como título (`transfer.rs`).
- A busca da Ajuda conta e destaca ocorrências na ordem em que os textos aparecem em cada aba.

## Decisões tomadas com o usuário

- No topo da aba Básico, acima da introdução, uma faixa informativa (MessageBar do Fluent UI) com o texto "Veja na aba Avançado como importar os textos que você já tem em pastas do Windows e arquivos .txt." e o botão **Ver como importar**.
- O botão troca para a aba Avançado e rola até a seção "Importar e exportar", que fica no topo da área visível; sem destaque extra.
- A seção "Importar e exportar" passa a explicar a importação de pastas: subpastas viram pastas, cada .txt vira um texto com o nome do arquivo como título, e **Pasta…** traz a própria pasta enquanto **Conteúdo de uma pasta…** traz só o que está dentro dela.

## Escopo

- `src/helpContent.ts`: texto da faixa e da seção "Importar e exportar"; identificador da seção para o botão.
- `src/components/HelpPage.tsx`: faixa, botão e rolagem; o texto da faixa entra na busca da Ajuda (é o primeiro texto da aba Básico).
- `src/components/HelpPage.test.tsx`: testes do botão e da busca.
- `docs/prototipo/ajuda.html` (faixa) e `npm run ajuda:imagens` para sincronizar os textos; nenhuma captura mostra a aba Básico da própria Ajuda, então nenhuma imagem muda.
- `docs/telas.md` (tela da Ajuda) e `CHANGELOG.md`.

Fora do escopo: mudanças na importação em si, no menu Importar e nas demais seções.

## Estado desejado

- Ao abrir a Ajuda, a faixa aparece antes da introdução; **Ver como importar** mostra a seção "Importar e exportar" na aba Avançado.
- A seção explica arquivos .txt, pasta, conteúdo de uma pasta e backup JSON.
- Buscar "importar" na Ajuda encontra também a faixa.

## Riscos e premissas

- A rolagem usa `scrollIntoView`, que o jsdom não tem; o teste confere a troca de aba e o pedido de rolagem, e a rolagem real fica no Marco.

## Estratégia de validação

`npm run test`, `npm run build` e `npm run lint`; conferência do protótipo; instalador de teste e verificação no Windows no Marco.

## Fase 1 — Faixa, botão e seção

- [x] Texto da faixa e seção "Importar e exportar" detalhada em `helpContent.ts`.
- [x] Faixa com **Ver como importar** no topo da aba Básico; o clique abre a aba Avançado e rola até a seção.
- [x] Texto da faixa incluído na busca, na ordem em que aparece.
- [x] Testes: o botão abre a aba Avançado com a seção; a busca encontra a faixa.
- [x] Critério: `npm run test`, `npm run build` e `npm run lint` sem erros.

## Fase 2 — Protótipo e documentação

- [x] Faixa no protótipo `ajuda.html` e textos sincronizados com `npm run ajuda:imagens`.
- [x] `docs/telas.md` descreve a faixa; `CHANGELOG.md` com a entrada em `[Unreleased]`.
- [x] Critério: protótipo e documentos coerentes com o implementado.

## Fase 3 — Instalador de teste

- [x] `npm run tauri -- build --config '{"version":"0.22.0-teste-092"}'` e cópia para `releases/teste/CSTM_0.22.0-teste-092_x64-setup.exe`.
- [x] Critério: build sem erros e instalador presente em `releases/teste/`.

## Marco — Validação do usuário

- [x] Instalar `releases/teste/CSTM_0.22.0-teste-092_x64-setup.exe` por cima da versão atual.
- [x] Abrir a Ajuda (`F1`): a faixa aparece no topo da aba Básico, antes da introdução.
- [x] Clicar em **Ver como importar**: abre a aba Avançado com "Importar e exportar" no topo da área visível.
- [x] Ler a seção "Importar e exportar": a explicação de pasta e conteúdo de uma pasta está clara.
- [x] Aceite do usuário: validado em 2026-10-20.
