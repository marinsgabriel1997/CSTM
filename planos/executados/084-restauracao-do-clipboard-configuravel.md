# 084 — Restauração do clipboard configurável

- Status: Concluído
- Prioridade: Média
- Criado em: 2026-10-16
- Concluído em: 2026-10-16

## Objetivo

Deixar o usuário escolher o que acontece com o clipboard depois de uma colagem pelo CSTM: manter o que foi colado (novo padrão) ou devolver o conteúdo anterior (comportamento até a 0.16.0). Na opção de devolver, restaurar também imagens e formatação, não só texto.

## Contexto

- Fluxo atual (p60, `src-tauri/src/paste.rs`): antes de escrever o texto escolhido, `paste` lê só o texto do clipboard (`clipboard::read_text`); 500 ms depois do `Ctrl+V` simulado, devolve esse texto se o número de sequência do clipboard não mudou (`text_to_restore`). Imagens, HTML e RTF que estavam no clipboard se perdem; sem texto antes, o colado fica.
- O Histórico (plano 077) já lê o clipboard em vários formatos: `clipboard::read()` devolve `Captured`, convertível em `Content` (texto com HTML e RTF, ou imagem), e `clipboard::write` escreve qualquer `Content`. As escritas do CSTM não entram no Histórico.
- Preferências ficam em `settings` (`src-tauri/src/db/settings.rs`) e aparecem em `src/components/SettingsPage.tsx`.
- O AGENTS.md exige nova validação no Windows para mudanças na restauração do clipboard.

## Decisões do usuário

- Nova configuração "Depois de colar", com **Manter o que foi colado** (padrão, também para quem já usa) e **Restaurar o conteúdo anterior** (comportamento até a 0.16.0).
- Restaurar passa a devolver tudo o que o CSTM consegue ler: texto, HTML, RTF e imagem.
- Com "Manter o que foi colado", o texto colado continua fora do Histórico.
- Motivo de "Manter": quando a colagem falha sem aviso (programa como administrador, programa que ignora a entrada simulada, foco no lugar errado), basta `Ctrl+V` para colar, sem abrir o menu de novo. Com "Restaurar", a falha silenciosa ainda devolve o conteúdo anterior e o texto escolhido se perde do clipboard.

## Escopo

### Incluído

- **Configuração**: chave `after_paste` em `settings` (`keep` | `restore`, padrão `keep`; ausente ou inválida vale `keep`), com get/set e testes; comandos `get_after_paste` e `set_after_paste`; `src/api.ts` e `src/test/fakeApi.ts`.
- **Colagem** (`paste.rs`):
  - `keep`: escreve, cola e não restaura nada.
  - `restore`: antes de escrever, guarda os bytes brutos dos formatos de texto, HTML, RTF, PNG e bitmap (`clipboard::snapshot`), sem decodificar imagens, sem o limite de 10 MB e sem o filtro de conteúdo sensível do Histórico (o leitor do Histórico, `clipboard::read()`, descartaria imagens grandes e senhas e decodificaria a imagem antes do `Ctrl+V`); 500 ms depois do `Ctrl+V`, se o número de sequência não mudou, devolve esses formatos (`clipboard::restore`). Se nada pôde ser guardado (clipboard vazio ou só com formatos não suportados, como arquivos do Explorer), o colado fica, como hoje sem texto anterior.
  - A regra de decisão (o que restaurar dado o capturado, a sequência e a configuração) fica numa função pura com testes, substituindo `text_to_restore`.
- **Copiar** não muda: deixa o texto no clipboard e não restaura, nas duas opções.
- **Configurações**: grupo de opções "Depois de colar" após "Modo de colagem padrão", gravado ao selecionar.
- **Textos sobre a colagem que falha**: na Ajuda (seção "Limites do Windows") e no README ("Limitações conhecidas"): programas abertos como administrador, e alguns outros, não recebem a colagem, e o Windows não avisa; com o padrão, basta `Ctrl+V`; o botão **Copiar**, à direita do texto selecionado no menu (ou `Ctrl+C`), copia sem colar. A limitação da restauração passa a dizer que, com "Restaurar", voltam texto, formatação e imagens, mas não arquivos copiados no Explorer.
- Desenho (`docs/telas.md` e `docs/prototipo/configuracoes.html`), `docs/produto.md` (fluxo de colagem e limitações), Ajuda (`src/helpContent.ts`), README e `CHANGELOG.md` (a mudança de padrão em Changed).
- AGENTS.md: a regra de arquitetura do p60 passa a descrever a restauração configurável (padrão manter).

### Fora do escopo

- Restaurar arquivos copiados no Explorer e outros formatos que o CSTM não lê.
- Mudar o intervalo de 500 ms.
- Colocar no Histórico o que o CSTM cola.

## Estado desejado

Depois de colar, o texto escolhido fica no clipboard, e uma colagem que falhou se resolve com `Ctrl+V`; quem quer o clipboard intacto escolhe "Restaurar" e o recebe de volta completo, com imagens e formatação.

## Riscos e premissas

- Capturar uma imagem grande antes de colar pode atrasar a colagem; medir no Marco com uma imagem de tela cheia. Se o atraso for perceptível, a decisão volta ao usuário.
- Programas que oferecem formatos sob demanda (renderização atrasada) entregam os dados na leitura; a captura passa a fazer essa leitura em toda colagem com "Restaurar".
- Formatos que o CSTM não lê se perdem mesmo com "Restaurar" quando o clipboard também tinha texto ou imagem (por exemplo, formatos próprios de um programa); a perda é a mesma de hoje e fica descrita nas limitações.
- Mudar o padrão altera o comportamento de quem já usa: depois de atualizar, o conteúdo anterior deixa de voltar até a pessoa escolher "Restaurar". Registrar no CHANGELOG e na Ajuda.
- A restauração continua dependendo do número de sequência: se outro programa escrever no clipboard nesses 500 ms, nada é restaurado.

## Estratégia de validação

- `npm run test:rust` (decisão de restauração: com conteúdo capturado e sequência intacta, com sequência mudada, sem captura, com `keep`; configuração com valor ausente ou inválido), `npm run lint:rust`, `cargo fmt --check`.
- `npm run test`, `npm run build`, `npm run lint` (campo nas Configurações).
- Instalador de teste em `releases/teste/` e validação manual no Windows (Marco).

## Fases

### Fase 1 — Desenho

- [x] `docs/telas.md` (Tela 3) e `docs/prototipo/configuracoes.html`: grupo "Depois de colar".

Critério: os documentos descrevem o comportamento deste plano.

### Fase 2 — Configuração e colagem (backend)

- [x] `after_paste` em `settings`, com get/set, comandos e testes.
- [x] Captura bruta antes da colagem e restauração dos formatos guardados, ou nenhuma captura com `keep`; função pura de decisão com testes.

Critério: `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check` passam.

### Fase 3 — Configurações (frontend)

- [x] `api.ts` e `fakeApi.ts` com `get/setAfterPaste`.
- [x] Grupo "Depois de colar" nas Configurações e testes Vitest.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Documentação e instalador de teste

- [x] `docs/produto.md`, `src/helpContent.ts`, README, AGENTS.md e `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações da estratégia passam e o instalador existe.

## Marco — Validação do usuário

- [x] Com o padrão (inclusive atualizando por cima da 0.16.0), depois de colar, `Ctrl+V` cola de novo o texto colado, e ele não aparece no Histórico.
- [x] Com "Restaurar", colar um texto devolve ao clipboard o texto que estava antes.
- [x] Com "Restaurar", copiar uma imagem (ou um trecho formatado do Word ou do navegador), colar um texto pelo CSTM e depois `Ctrl+V`: volta a imagem (ou o trecho com a formatação).
- [x] A colagem com uma imagem de tela cheia no clipboard não fica perceptivelmente mais lenta.
- [x] A opção é lembrada depois de sair e abrir o CSTM.
- [x] **Copiar** continua deixando o texto no clipboard, nas duas opções.
- [x] A Ajuda e o README explicam o que fazer quando a colagem falha.

Resultado: validado pelo usuário no Windows com o instalador de teste 0.17.0-teste-084 em 2026-10-16. Aceite: homologado.
