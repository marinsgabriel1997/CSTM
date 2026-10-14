# p50 — Menu de colagem

## Objetivo

Abrir, pelo atalho global `Alt+Q`, um menu flutuante junto ao cursor do mouse com busca, favoritos e pastas navegáveis, e permitir escolher um texto pelo teclado ou pelo mouse. Neste plano, escolher um texto o copia para o clipboard e fecha o menu; a colagem na janela anterior fica para o p60.

## Contexto

O aplicativo tem a janela `main` (cadastro) e roda na bandeja com instância única (p40). Não há janela `picker`, atalho global nem acesso ao clipboard. O backend já expõe `list_folders`, `list_all_snippets`, `list_favorites` e `search_snippets`. O desenho do menu é a Tela 2 de `docs/telas.md`, com o protótipo `docs/prototipo/picker.html`. Corresponde à etapa 5 de `docs/mvp.md`.

## Decisões

1. Atalho padrão: `Alt+Q`.
2. Posição: junto ao cursor do mouse, ajustada à área útil do monitor em que o cursor está.
3. Escolher um texto no p50 copia o conteúdo para o clipboard e fecha o menu; o p60 substitui esse passo pela colagem completa.
4. A busca do menu usa a mesma busca do backend (FTS5), sem destaque de termos.

## Escopo

- Desenho do menu em `docs/telas.md` (Tela 2) e protótipo em `docs/prototipo/picker.html`, aprovados antes da implementação.
- Janela `picker` em `tauri.conf.json`: criada oculta, sem bordas, sempre no topo, fora da barra de tarefas, sem redimensionamento, tamanho fixo. Página própria `picker.html` como segunda entrada do Vite.
- Módulo `picker` no backend: mostrar (com posicionamento) e ocultar o menu. O cálculo da posição é uma função pura com testes.
- `tauri-plugin-global-shortcut`: `Alt+Q` abre o menu ou o fecha, se já estiver aberto. Falha no registro do atalho é exibida como aviso no cadastro.
- `tauri-plugin-clipboard-manager` para copiar o texto escolhido.
- Interface do menu: busca com foco automático, favoritos, pastas navegáveis, teclado e mouse, fechamento com `Esc` e ao perder o foco. Os dados são recarregados a cada abertura.
- Capabilities da janela `picker`.
- Testes do frontend (navegação, busca, fechamento, escolha) e do backend (posicionamento).
- Documentação: `docs/telas.md`, `docs/mvp.md` (decisões resolvidas), `README.md` e `CHANGELOG.md`.

Fora do escopo: foco na janela anterior, simulação de `Ctrl+V` e restauração do clipboard (p60); contador de uso (p60); configuração do atalho pela interface.

## Estado desejado

1. `Alt+Q` em qualquer programa mostra o menu junto ao cursor, inteiramente dentro da área útil do monitor, com o campo de busca focado.
2. O menu mostra favoritos e o conteúdo da raiz; pastas abrem e voltam pelo teclado e pelo mouse.
3. Digitar busca em todos os textos; a lista acompanha a digitação.
4. `Enter` ou clique num texto copia o conteúdo para o clipboard e fecha o menu.
5. `Esc`, clique fora ou `Alt+Q` com o menu aberto o fecham sem copiar.
6. Alterações feitas no cadastro aparecem na próxima abertura do menu.
7. Com `Alt+Q` ocupado por outro programa, o cadastro informa que o atalho não pôde ser registrado.

## Premissas

- O processo que registra o atalho global recebe permissão do Windows para trazer a própria janela ao primeiro plano.
- `AppHandle::cursor_position` e a área útil do monitor (`Monitor::work_area`) estão disponíveis no Tauri 2.

## Riscos

- `Alt+Q` é usado pela caixa "Pesquisar" do Office 365; com o CSTM em execução, o atalho global tem precedência.
- Janelas em tela cheia exclusiva podem ficar por cima do menu.
- Monitores com escalas diferentes (DPI misto) podem deslocar a posição; validar no Windows.
- No p50 a escolha substitui o conteúdo do clipboard sem restaurá-lo (restauração no p60).

## Estratégia de validação

- Testes do frontend com Vitest e `fakeApi`; testes do posicionamento com `cargo test`.
- `npm run test`, `npm run build`, `npm run lint`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` em `src-tauri/`, `cargo build`.
- Validação manual no Windows dos itens do estado desejado, incluindo dois monitores quando disponível.

## Fases

### Fase 1 — Desenho

- [x] Desenhar a Tela 2 em `docs/telas.md`.
- [x] Criar o protótipo `docs/prototipo/picker.html`.

Critério: desenho e protótipo aprovados pelo usuário.

Desenho e protótipo aprovados.

### Fase 2 — Janela e atalho

- [x] Declarar a janela `picker`, a entrada `picker.html` e as capabilities.
- [x] Criar o módulo `picker` com mostrar, ocultar e posicionamento, com testes.
- [x] Registrar `Alt+Q` e expor a falha de registro ao cadastro.

Critério: `cargo build`, `npm run test:rust`, `npm run lint:rust`, `cargo fmt --check` e `npm run build` passam.

### Fase 3 — Interface do menu

- [x] Implementar busca, favoritos, pastas, teclado, mouse e fechamento.
- [x] Copiar o texto escolhido e fechar o menu.
- [x] Aviso de atalho indisponível no cadastro.
- [x] Testes do frontend.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

### Fase 4 — Documentação e validação

- [x] Atualizar `docs/telas.md`, `docs/mvp.md`, `AGENTS.md`, `README.md` e `CHANGELOG.md`.
- [x] Validação manual no Windows.

Critério: validações automáticas passam e o roteiro manual é aprovado no Windows.

Validações automáticas e roteiro manual no Windows aprovados.
