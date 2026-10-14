# 077 — Histórico do clipboard e link do GitHub no instalador

- Status: Concluído
- Prioridade: Alta
- Criado em: 2026-10-14
- Concluído em: 2026-10-14

## Objetivo

1. O CSTM passa a monitorar o clipboard e a guardar os últimos 100 itens copiados: texto, com a formatação HTML/RTF quando houver, e imagens. O histórico aparece no menu de colagem numa pasta virtual **Histórico**, no topo, e cada item cola ou copia como um texto cadastrado.
2. O instalador e a entrada em "Aplicativos instalados" do Windows passam a mostrar o link do repositório: <https://github.com/marinsgabriel1997/CSTM>.

## Contexto

- O histórico do clipboard está fora do escopo no `AGENTS.md` e no `docs/mvp.md`. Esta entrega o traz para o escopo, por decisão do usuário.
- Hoje o clipboard só é usado pelo módulo `paste`, por meio do `tauri-plugin-clipboard-manager`, que só lê e escreve texto. A restauração depois da colagem também é só de texto (limitação documentada no p60).
- O menu de colagem já tem pastas virtuais (Mais usados e Favoritos), montadas no frontend a partir dos textos cadastrados.
- O banco é SQLite com migrações (`0001`–`0003`). A conexão fica num `Mutex` gerenciado pelo Tauri.
- O instalador usa um template NSIS próprio (`src-tauri/windows/installer.nsi`), que já grava `URLInfoAbout`, `URLUpdateInfo` e `HelpLink` quando `HOMEPAGE` não está vazio. O valor vem de `bundle.homepage`, hoje ausente.

## Decisões do usuário

- Tipos guardados: **texto**, **imagens** e **formatação HTML/RTF** junto com o texto. Arquivos copiados no Explorer (lista de caminhos) ficam de fora.
- O cadastro continua só com texto. Outros tipos ficam só no histórico.
- O histórico fica no disco (banco SQLite), com os **100** itens mais recentes, e sobrevive a reinícios.
- O monitoramento vem **ligado por padrão**. Nas Configurações há um interruptor para desligá-lo e um botão para limpar o histórico. O conteúdo que gerenciadores de senha marcam como sensível é ignorado.

## Escopo

### Incluído

- **Link no instalador:**
  - `bundle.homepage` em `tauri.conf.json`;
  - um link "CSTM no GitHub" na página final do instalador (`MUI_FINISHPAGE_LINK`).
- **Monitor do clipboard (backend, Windows):**
  - uma janela só de mensagens, numa thread própria, registrada com `AddClipboardFormatListener`;
  - a cada `WM_CLIPBOARDUPDATE`, lê os formatos suportados e grava um item.
- **Formatos lidos:**
  - `CF_UNICODETEXT`;
  - `HTML Format` e `Rich Text Format`, só junto com o texto;
  - `CF_DIBV5`/`CF_DIB`, convertidos em PNG, mais uma miniatura PNG de até 64 px para o menu.
- **O que é ignorado:**
  - conteúdo com `ExcludeClipboardContentFromMonitorProcessing`, `Clipboard Viewer Ignore` ou `CanIncludeInClipboardHistory = 0`;
  - o que o próprio CSTM escreve (colagem, cópia e restauração);
  - itens vazios;
  - itens acima de 10 MB.
- **Persistência:** a migração `0004_clipboard_history.sql` cria a tabela `clipboard_items`, com estas colunas:
  - `id`, `kind` (`text`/`image`);
  - `text`, `html`, `rtf`;
  - `image`, `thumbnail` (BLOB PNG), `width`, `height`;
  - `created_at`.

  Um item igual a outro já guardado não é duplicado: o existente sobe para o topo. Ao passar de 100 itens, os mais antigos são apagados.
- **Colar e copiar um item:** generalizar a escrita no clipboard de `paste` para gravar vários formatos de uma vez (texto + HTML + RTF, ou imagem como `CF_DIB`), com chamadas Win32 diretas. O fluxo continua o mesmo: guardar a janela, ocultar o menu, `Ctrl+V` e restaurar o texto anterior após 500 ms se o clipboard ainda tiver o que foi colado. Usar um item o leva ao topo do histórico.
- **Comandos e eventos:**
  - `list_clipboard_history`, sem os dados completos da imagem, só a miniatura;
  - `paste_clipboard_item` e `copy_clipboard_item`;
  - `clear_clipboard_history`;
  - `get_clipboard_monitoring` e `set_clipboard_monitoring`;
  - o evento `clipboard-history-changed`, para o menu recarregar.
- **Menu de colagem:**
  - a pasta virtual **Histórico** (ícone de relógio) vem antes de Mais usados e Favoritos, aparece com o monitoramento ligado e pelo menos um item, e lista os itens do mais recente para o mais antigo;
  - texto: o título é a primeira linha não vazia, encurtada, e a dica mostra o conteúdo;
  - imagem: miniatura e "Imagem L×A";
  - o botão Copiar e o `Ctrl+C` valem como nos textos;
  - a busca continua só nos textos cadastrados.
- **Configurações:** uma seção "Histórico do clipboard" com:
  - o interruptor "Guardar o histórico do clipboard", ligado por padrão (chave `clipboard_history` em `settings`); desligar para de monitorar e não apaga nada;
  - o botão "Limpar histórico", com confirmação.
- **Documentação:**
  - `AGENTS.md` e `docs/mvp.md`: o histórico sai da lista de fora do escopo; arquitetura, tabela e dependência descritas;
  - `docs/telas.md`, `docs/prototipo/picker.html` e `docs/prototipo/configuracoes.html` atualizados **antes** da implementação da interface;
  - `CHANGELOG.md`.

### Fora do escopo

- Arquivos copiados no Explorer e outros formatos (áudio, formatos próprios de programas).
- Imagens, arquivos ou formatação no cadastro, e salvar um item do histórico como texto cadastrado (pode virar um plano próprio).
- Busca no histórico, fixar itens, excluir um item avulso e mostrar o histórico na janela de cadastro.
- Criptografia do histórico no disco.
- Restaurar formatos não textuais depois da colagem: continua só texto, como no p60.

## Estado desejado

- Copiar um texto, um trecho formatado do Word ou do navegador, ou um print em qualquer programa faz o item aparecer em segundos no topo de Menu de colagem → Histórico.
- Escolher um item cola no programa anterior: o texto com a formatação quando o destino aceita, e a imagem como imagem. O botão Copiar deixa o item no clipboard.
- Colar ou copiar pelo CSTM não cria itens duplicados no histórico.
- O histórico guarda no máximo 100 itens e sobrevive a reinícios.
- Desligar a opção para o monitoramento na hora. Limpar apaga todos os itens.
- O instalador mostra o link do GitHub na página final, e "Aplicativos instalados" mostra o link do suporte.

## Dependências

- `image` (Rust), com as features `png` e `bmp`: decodificar o DIB, gerar o PNG e a miniatura. Sem novas dependências no frontend.
- Nenhuma feature nova do crate `windows`: as atuais (`DataExchange`, `WindowsAndMessaging`, `Gdi`) cobrem o listener e o clipboard. `Win32_System_Memory` pode ser necessária para `GlobalAlloc`/`GlobalLock`.

## Riscos

| Risco | Mitigação |
| --- | --- |
| Clipboard aberto por outro programa no momento da leitura | Tentar de novo algumas vezes com pequena espera; se falhar, descartar o item, sem travar. |
| Dados sensíveis (senhas, tokens) gravados em disco sem criptografia | Respeitar os formatos de exclusão, ter o interruptor e o "Limpar histórico", e documentar a limitação. |
| O CSTM capturar a própria escrita (colagem, restauração) | Ignorar atualizações cujo dono do clipboard é uma janela do próprio processo, e comparar o número de sequência. |
| Imagens grandes pesando no banco e na memória | Limite de 10 MB por item, PNG comprimido, miniatura separada para o menu e limite de 100 itens. |
| DIBV5 com transparência ou formatos de bits incomuns | Aceitar `CF_DIBV5` e cair para `CF_DIB`; se a decodificação falhar, o item não é guardado. Testar prints do Windows e imagens do navegador. |
| HTML Format com cabeçalho de offsets incorreto | Guardar e regravar o bloco como veio. O texto simples sempre vai junto, como reserva. |
| Uso do banco pela thread do monitor competindo com os comandos | A mesma conexão em `Mutex`, com escritas curtas. A leitura do clipboard acontece fora do lock. |

## Premissas

- Só Windows. Fora dele o monitor é um stub inativo, como em `autostart`.
- O `Ctrl+V` simulado e a restauração continuam com as regras do p60. Colar uma imagem depende de o programa de destino aceitar `CF_DIB`.

## Estratégia de validação

- **Rust:**
  - testes de banco: inserção, deduplicação, subir ao topo, corte em 100 e limpar;
  - testes de conversão: DIB para PNG, miniatura e título do texto;
  - testes da decisão de ignorar (formatos de exclusão, tamanho);
  - `npm run test:rust`, `npm run lint:rust` e `cargo fmt --check`.
- **Frontend:**
  - testes do menu: pasta Histórico, ordem, colar, copiar e `Ctrl+C`, imagem e ausência com o histórico vazio ou desligado;
  - testes das Configurações: interruptor, limpar com confirmação e erro;
  - `fakeApi` atualizado;
  - `npm run test`, `npm run build` e `npm run lint`.
- **Instalador:** `npm run tauri -- build` e conferência do link no `.nsi` gerado.
- **Funcional no Windows:** pelo Marco, com o instalador de teste em `releases/teste/`.

## Fases

### Fase 1 — Link do GitHub no instalador

- [x] Adicionar `bundle.homepage` em `tauri.conf.json`.
- [x] Adicionar `MUI_FINISHPAGE_LINK` ("CSTM no GitHub") e `MUI_FINISHPAGE_LINK_LOCATION` em `installer.nsi`.

Critério: o build gera o instalador sem erro, e o script NSIS gerado contém a URL nas duas posições.

Resultado: `npm run tauri -- build` passou; o `installer.nsi` gerado tem `HOMEPAGE` com a URL e o `MUI_FINISHPAGE_LINK_LOCATION` apontando para ele.

### Fase 2 — Desenho das telas

- [x] Atualizar `docs/telas.md`: pasta Histórico no menu (posição, itens de texto e imagem, dica, copiar) e a seção nas Configurações.
- [x] Atualizar `docs/prototipo/picker.html` e `docs/prototipo/configuracoes.html`.

Critério: o desenho e os protótipos descrevem todos os estados do escopo (com itens, vazio, desligado e imagem).

Resultado: o menu mostra a hora da cópia à direita de cada item (de outro dia, "ontem" ou a data); a limpeza é confirmada no próprio lugar do botão, sem outro diálogo. Durante a fase 6, `telas.md` passou a dizer que o Histórico aparece mesmo sem textos cadastrados.

### Fase 3 — Banco do histórico

- [x] Migração `0004_clipboard_history.sql` e módulo `db/clipboard.rs`: inserir com deduplicação e corte, listar, buscar por id, subir ao topo e limpar.
- [x] A configuração `clipboard_history` em `db/settings.rs`, padrão ligado.
- [x] Testes.

Critério: `cargo test` passa, inclusive `migrations_are_valid`.

Resultado: passa. `html` e `rtf` são BLOB (os bytes como vieram); a ordem usa a coluna `position`, e `copied_at` guarda a última cópia ou uso, mostrada no menu.

### Fase 4 — Leitura e escrita multiformato do clipboard

- [x] Leitura no Windows: texto, HTML, RTF e DIBV5/DIB, com as regras de exclusão e de tamanho e a conversão para PNG e miniatura.
- [x] Escrita no Windows de um item com vários formatos. `paste::paste` e `paste::copy` passam a aceitar o item, mantendo o comportamento atual para os textos cadastrados.
- [x] Testes das partes puras: conversão, título, decisão de ignorar.

Critério: testes e clippy passam, e os testes atuais de `paste` continuam passando sem alteração de expectativa.

Resultado: passa. Módulo novo `clipboard`; além de `DIBV5`/`DIB`, a leitura usa o formato registrado `PNG` quando o programa o oferece, e a escrita de uma imagem grava `CF_DIB` e `PNG`. Um bitmap de 32 bits com o alfa todo zerado é tratado como opaco. Features novas do crate `windows`: `Win32_System_Memory` e `Win32_System_LibraryLoader` (módulo da janela do monitor).

### Fase 5 — Monitor e comandos

- [x] Módulo `clipboard_history`: thread com janela só de mensagens e `AddClipboardFormatListener`, ignorando as escritas do próprio CSTM, gravando no banco e emitindo `clipboard-history-changed`.
- [x] Ligar e desligar em tempo de execução, conforme a configuração.
- [x] Comandos listados no escopo, registrados em `lib.rs`.

Critério: `cargo test`, clippy e fmt passam. Com o app em `tauri dev`, copiar um texto e um print gera dois itens no banco, e colar pelo CSTM não gera item novo.

Resultado: testes, clippy e fmt passam. Em `tauri dev` (com cópia de segurança do banco, restaurada ao fim), copiar um texto e uma imagem pelo PowerShell gerou um item de texto e um de imagem (120 × 80, com miniatura); copiar o mesmo texto de novo o subiu sem repetir; um trecho com `HTML Format` foi guardado com o HTML; um texto marcado com `ExcludeClipboardContentFromMonitorProcessing` foi ignorado. Que colar pelo CSTM não gera item novo não foi automatizado (exige o atalho e o menu): fica no Marco. A janela do monitor é a dona do clipboard nas escritas do CSTM, e o monitor ignora as mudanças cuja dona é ela.

### Fase 6 — Interface

- [x] `src/api.ts` e `src/test/fakeApi.ts`: tipos, comandos e evento.
- [x] `Picker.tsx`: pasta virtual Histórico com itens de texto e imagem, colar, copiar e `Ctrl+C`.
- [x] `SettingsDialog.tsx`: o interruptor e "Limpar histórico" com confirmação.
- [x] Testes do menu e das Configurações.

Critério: `npm run test`, `npm run build` e `npm run lint` passam.

Resultado: passam (165 testes). Com a biblioteca vazia, o menu mostra o Histórico em vez de "Nenhum texto cadastrado." quando há itens.

### Fase 7 — Documentação e instalador de teste

- [x] `AGENTS.md`, `docs/mvp.md` (escopo, arquitetura, tabela, dependências e limitações) e `CHANGELOG.md` em `[Unreleased]`.
- [x] Gerar o instalador de teste em `releases/teste/`.

Critério: todas as validações automatizadas passam e o instalador de teste existe.

Resultado: `npm run test` (165), `npm run build`, `npm run lint`, `npm run test:rust` (110), `npm run lint:rust` e `cargo fmt --check` passam. Instalador: `releases/teste/CSTM_0.12.0-teste-077-20261014-1547_x64-setup.exe`.

## Marco — Validação do usuário

- [x] Instalador: a página final mostra o link "CSTM no GitHub" e o abre no navegador. Em Aplicativos instalados, o CSTM mostra o link.
- [x] Copiar um texto no Bloco de Notas: ele aparece no topo de Menu de colagem → Histórico. Escolhê-lo cola no programa anterior.
- [x] Copiar um trecho formatado (Word ou navegador) e colá-lo pelo Histórico no Word: a formatação vem junto. No Bloco de Notas, vem só o texto.
- [x] Copiar um print (`Win+Shift+S`): aparece com miniatura e tamanho. Colá-lo no Paint ou no Word cola a imagem.
- [x] Botão Copiar e `Ctrl+C` num item do histórico: o item fica no clipboard, sem colar.
- [x] Colar pelo CSTM (cadastro ou histórico) não cria item repetido. Copiar de novo algo já guardado o sobe para o topo.
- [x] Copiar uma senha num gerenciador de senhas (por exemplo, Bitwarden ou KeePass): não aparece no histórico.
- [x] Reiniciar o CSTM: o histórico continua lá. Com mais de 100 cópias, ficam só as 100 mais recentes.
- [x] Desligar "Guardar o histórico do clipboard": novas cópias não entram, e a pasta some do menu. Religar volta a guardar.
- [x] "Limpar histórico" pede confirmação e apaga tudo.
- [x] A colagem e a cópia dos textos cadastrados continuam como antes.

Resultados:

- 2026-10-14, instalador `CSTM_0.12.0-teste-077-20261014-1547`: o usuário validou o texto sem formatação, o texto formatado e a imagem. As demais verificações estão pendentes.
- 2026-10-14: o usuário validou todas as demais verificações.

Aceite: concedido pelo usuário em 2026-10-14.
