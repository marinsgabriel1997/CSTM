import { prepararSessao } from "../support/windows/sessao";

// Antes de qualquer teste do Windows: guarda o clipboard do usuário e fecha o CSTM instalado.
export default async function globalSetup(): Promise<void> {
  await prepararSessao();
}
