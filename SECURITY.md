# Política de segurança

## Versões com suporte

Só a [versão mais recente](https://github.com/marinsgabriel1997/CSTM/releases/latest) recebe correções de segurança. As correções saem numa nova versão; versões anteriores não são atualizadas.

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o [reporte privado do GitHub](https://github.com/marinsgabriel1997/CSTM/security/advisories/new), que fica visível só para quem mantém o projeto.

Inclua, se possível:

- a versão do CSTM e do Windows;
- os passos para reproduzir;
- o impacto: o que alguém consegue fazer explorando a falha.

## O que esperar

O CSTM é mantido por uma pessoa, sem prazo garantido de resposta. Todo reporte recebe confirmação. Quando a falha for confirmada, a correção sai numa nova versão, e quem reportou recebe crédito no aviso de segurança, se quiser.

## Contexto do aplicativo

O CSTM roda localmente no Windows, sem conta e sem serviços na nuvem. Os dados ficam em `%APPDATA%\com.gabriel.cstm\cstm.db`, inclusive o histórico da área de transferência, que pode guardar o que foi copiado.
