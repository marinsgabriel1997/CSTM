# 088 — Barra de atualização verde

- Status: Em validação
- Prioridade: Média
- Criado em: 2026-10-19

## Objetivo

Fazer a barra de versão nova, no topo do cadastro, chamar a atenção: fundo verde com texto escuro e botões pretos, igual nos dois temas, com o texto e os botões juntos e centralizados.

## Contexto

- A barra (plano 087, `src/components/UpdateBar.tsx`) usa o `MessageBar` do Fluent UI com `intent="info"`: o fundo é um tom neutro, quase igual ao da janela no tema escuro, e passa despercebido.
- No `MessageBar`, o texto fica à esquerda e os botões **Abrir página da release** e **Dispensar** no canto direito, longe do texto.
- A barra só aparece quando o GitHub tem uma versão maior que a instalada. A nova barra só pode ser vista no aplicativo instalado depois que sair a versão seguinte a esta.

## Escopo

1. **Cor:** fundo verde médio (#3CB043) com texto e ícone quase pretos (#06200A), iguais nos temas claro e escuro, para a barra se destacar da janela nos dois temas. Os botões são pretos com texto branco nos dois temas.
2. **Disposição:** ícone, texto e os dois botões numa linha só, juntos e centralizados na largura da janela, com espaço pequeno entre eles. Em janela estreita (mínimo de 760 px), a linha continua inteira.
3. **Ícone:** `ArrowDownload` no lugar do ícone de informação.
4. **Sem mudança de comportamento:** o texto, os botões, a região acessível "Atualização disponível", Dispensar e a regra de quando a barra aparece continuam iguais.

Fora do escopo: mudanças na notificação do Windows, na seção Atualizações das Configurações e na regra de verificação.

## Estado desejado (técnico)

- `UpdateBar.tsx` sem o `MessageBar` (o layout dele não centraliza), com `role="region"` e o `aria-label` no elemento da barra, envolvida num `FluentProvider` com o `webLightTheme` para que fontes e tokens não mudem com o tema do aplicativo.
- Estilos em `makeStyles` com cores fixas: fundo #3CB043, texto #06200A, borda inferior #2A8A30; botões `Button` do Fluent UI (`size="small"`) pretos com texto branco, com tons de hover e de clique.
- `App.tsx` não muda.

## Riscos

- **Tema fixo na barra:** o `FluentProvider` aninhado precisa herdar a fonte e não criar fundo ou espaço extra em volta da barra; conferir nos dois temas no Marco.
- **Validação tardia:** a barra nova só aparece no aplicativo instalado quando o GitHub tiver uma versão maior que esta. O Marco tem duas etapas: o protótipo antes da publicação, e o aplicativo real depois da release seguinte (plano 089), com esta versão instalada.

## Premissas

- Versão da entrega: 0.19.1 (PATCH, ajuste visual), publicada sozinha antes do plano 089.
- O Marco do plano 087 (segunda etapa, com a 0.18.0) segue em paralelo e vê a barra antiga, da 0.18.0.

## Estratégia de validação

- Frontend: `npm run test` (os testes da barra em `App.test.tsx` continuam passando sem mudar as expectativas), `npm run build` e `npm run lint`.
- Visual: protótipo `docs/prototipo/cadastro.html`, estado **Versão nova**, nos dois temas; depois, o aplicativo instalado.

## Fase 0 — Desenho

- [x] `docs/telas.md`, Tela 1, linha "Versão nova": fundo verde com texto quase preto e botões pretos, igual nos dois temas; texto e botões centralizados; ícone de download.
- [x] `docs/prototipo/cadastro.html`: `.update-bar` com as mesmas cores e o conteúdo centralizado, igual nos dois temas.
- [x] Protótipo voltou a abrir: duas quebras de linha literais (no conteúdo do item `h1` do Histórico e na expressão regular que troca quebras por `<br>`), vindas do plano 086, deixavam o script com erro e a janela em branco.

Critério: desenho registrado e coerente com o escopo.

## Fase 1 — Interface

- [x] `UpdateBar.tsx` com o fundo verde, o texto escuro, os botões pretos, o ícone de download e o conteúdo centralizado.

Critério: `npm run test`, `npm run build` e `npm run lint` passando. Resultado: 249 testes passando, build e lint sem erro.

## Fase 2 — Documentação

- [x] `CHANGELOG.md` (`Changed`). A Ajuda (`src/helpContent.ts`) não descreve a cor nem a posição dos botões e não muda.

Critério: documentação revisada e coerente com o código.

## Marco — Validação do usuário

- [x] Antes da publicação, no protótipo `docs/prototipo/cadastro.html` (estado **Versão nova**): fundo verde com texto escuro e botões pretos, juntos e centralizados, nos temas claro e escuro.
- [ ] Depois da publicação da release do plano 089, com a 0.19.1 instalada: a barra aparece verde, com texto escuro, botões pretos e centralizada, nos dois temas; Abrir página da release e Dispensar continuam funcionando.

Resultados:

- Primeira versão do protótipo (verde claro #DFF6DD, botões brancos): pouco destaque; pedido fundo verde mais escuro e botões pretos com texto branco. Ajustado no protótipo e aprovado ("ficou bom pode seguir"), depois aplicado no componente. Item do protótipo aceito em 2026-10-19.

Aceite: —
