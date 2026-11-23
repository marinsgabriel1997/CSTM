import { powershell } from "./windows/powershell";

const PREAMBULO = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Janela {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int a, bool repaint);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint mensagem, IntPtr w, IntPtr l);
}
"@
[Janela]::SetProcessDPIAware() | Out-Null
`;

function janelaDoProcesso(pid: number): string {
  return `
${PREAMBULO}
$p = Get-Process -Id ${pid}
$h = $p.MainWindowHandle
if ($h -eq 0) { throw "O processo ${pid} não tem janela visível." }
`;
}

/**
 * Move e redimensiona a janela principal do processo pela API do Windows (como arrastar a borda),
 * em pixels físicos e incluindo a moldura. Não usa teclado nem mouse.
 */
export function posicionarJanela(pid: number, x: number, y: number, largura: number, altura: number): void {
  powershell(`${janelaDoProcesso(pid)}
if (-not [Janela]::MoveWindow($h, ${x}, ${y}, ${largura}, ${altura}, $true)) { throw "MoveWindow falhou" }`);
}

/** Pede o fechamento da janela principal (WM_CLOSE), o mesmo que o botão X da barra de título. */
export function fecharJanelaPeloSistema(pid: number): void {
  powershell(`${janelaDoProcesso(pid)}
if (-not [Janela]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)) { throw "PostMessage falhou" }`);
}
