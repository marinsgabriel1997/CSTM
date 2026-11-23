import process from "node:process";

/**
 * Modo ensaio (CSTM_E2E_ENSAIO=1, ex.: "CSTM_E2E_ENSAIO=1 npm run test:windows"): o setup só prova que o helper sobe no
 * contexto do Playwright (ping) e lista o CSTM instalado, sem fechar nada, sem salvar nem restaurar o clipboard e sem
 * agir sobre uma sessão anterior pendente; os testes do Windows são pulados. Não usa teclado, mouse nem clipboard.
 */
export const ENSAIO = process.env.CSTM_E2E_ENSAIO === "1";
