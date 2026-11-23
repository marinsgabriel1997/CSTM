import { restaurarSessao } from "../support/windows/sessao";

// Depois dos testes (também em falha ou interrupção): devolve o clipboard e reabre o CSTM instalado.
export default async function globalTeardown(): Promise<void> {
  await restaurarSessao();
}
