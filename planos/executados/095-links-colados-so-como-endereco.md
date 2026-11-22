# 095 — Links colados só como endereço

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-11-22
- Concluído em: 2026-11-22
- Issue: #5

## Objetivo

Nos modos Sem formatação e Google Chat, colar só a URL de destino dos links e imagens em markdown, sem o texto de exibição e sem os parênteses.

## Contexto

- A conversão fica em `src-tauri/src/markdown.rs` (`Walker`, usado por `to_plain` e `to_google_chat`). Hoje, ao fechar um link ou imagem (`TagEnd::Link | TagEnd::Image`), o texto de exibição fica e a URL é acrescentada como ` (url)`, exceto quando o texto está vazio (fica só a URL) ou já é a URL (ou a URL é `mailto:` + texto).
- O texto de reserva do modo Formatado usa `to_plain`; o HTML do Formatado tem o link de verdade e não muda.
- A Ajuda (`src/helpContent.ts` e o protótipo `docs/prototipo/ajuda.html`) diz que no Google Chat os links aparecem como texto seguido do endereço.

## Decisões tomadas com o usuário

- Links: só a URL de destino, preservada inteira (caminho, parâmetros e fragmento).
- Imagens: mesma regra dos links (`![logo](url)` vira `url`).
- Links de e-mail: sem o prefixo `mailto:` (`[Fale conosco](mailto:a@b.com)` vira `a@b.com`).
- Vale para Sem formatação **e** Google Chat.
- O texto de reserva do Formatado acompanha o Sem formatação (mesma função).

## Decisões de execução

- Link ou imagem com destino vazio (`[x]()`) mantém o texto de exibição, para não sumir com o conteúdo.
- URLs já em texto simples e autolinks (`<https://a.com>`) ficam como estão.
- Versão PATCH (correção): 1.1.2 no commit de entrega; instalador de teste `1.1.2-teste-095`.

## Escopo

- `src-tauri/src/markdown.rs`: a regra no fechamento de link e imagem e os testes afetados.
- `src/helpContent.ts` e `docs/prototipo/ajuda.html`: a frase sobre links nos modos de colagem. Nenhuma tela muda, então as imagens da Ajuda não são regeneradas.
- `CHANGELOG.md`: entrada em `[Unreleased]`, categoria `Fixed`.

Fora do escopo: modo Markdown, HTML do Formatado, normalização do Histórico para markdown.

## Estado desejado

- `[www.exemplo.com.br](https://www.exemplo.com.br)` cola `https://www.exemplo.com.br`; `[Acessar o site](https://www.exemplo.com.br/pagina)` cola `https://www.exemplo.com.br/pagina`, nos dois modos.
- O restante do texto convertido não muda.

## Riscos e premissas

- Quem dependia do texto descritivo do link no Sem formatação ou no Chat passa a receber só o endereço (decisão do usuário).
- Links com ênfase dentro (`[**ação**](u)`) também viram só a URL, sem marcadores no Chat.

## Estratégia de validação

- `npm run test:rust` com testes atualizados e novos (links descritivos, URL como texto, parâmetros e fragmento, imagem, mailto, destino vazio, URL em texto simples, Chat).
- `npm run lint:rust` e `cargo fmt --check`.
- `npm run test` e `npm run build` (a Ajuda muda).
- Instalador de teste em `releases/teste/` e validação do usuário no Windows.

## Fase 1 — Conversão

- [x] Regra nova no fechamento de link e imagem em `markdown.rs`.
- [x] Testes atualizados e novos.
- Critério: `npm run test:rust` (198 testes), `npm run lint:rust` e `cargo fmt --check` passam. ✔

## Fase 2 — Ajuda, documentação e instalador

- [x] Frase da Ajuda em `src/helpContent.ts` e `docs/prototipo/ajuda.html`.
- [x] `CHANGELOG.md`.
- [x] `npm run test` e `npm run build` passam.
- [x] Instalador `releases/teste/CSTM_1.1.2-teste-095_x64-setup.exe`.
- Critério: validações passam (`npm run test`, `npm run build` e `npm run lint`) e o instalador existe. ✔

## Marco — Validação do usuário

- [x] Colar sem formatação `[www.exemplo.com.br](https://www.exemplo.com.br)` num editor (ex.: Bloco de Notas) cola só `https://www.exemplo.com.br`.
- [x] Colar sem formatação `[Acessar o site](https://www.exemplo.com.br/pagina?x=1#topo)` cola só a URL inteira.
- [x] Colar no modo Google Chat um texto com link cola só a URL.
- [x] Colar no modo Formatado no Word ou Outlook continua com o link clicável e o texto de exibição.
- [x] O resto do texto (negrito, listas, parágrafos) sai como antes nos três modos.

Resultados: todas as verificações aprovadas pelo usuário com o instalador `1.1.2-teste-095`.

Aceite: validado pelo usuário em 2026-11-22.
