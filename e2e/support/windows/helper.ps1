# Helper do teste do Windows (ver Helper.cs). Mantem este arquivo em ASCII: o PowerShell 5.1 le .ps1 sem BOM como ANSI.
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$codigo = [System.IO.File]::ReadAllText((Join-Path $dir 'Helper.cs'), [System.Text.Encoding]::UTF8)
Add-Type -TypeDefinition $codigo -Language CSharp -ReferencedAssemblies @(
  'System.Windows.Forms', 'System.Drawing', 'System.Web.Extensions', 'System.Core',
  'UIAutomationClient', 'UIAutomationTypes', 'WindowsBase'
)
[Servidor]::Executar()
