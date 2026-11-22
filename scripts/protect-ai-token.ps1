# PowerShell / protect-ai-token.ps1 / Windows / proteção DPAPI do token local de IA.
$ErrorActionPreference = 'Stop'
$previewRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.local-preview'
$pendingToken = Join-Path $previewRoot 'ai-token-pending.txt'
$protectedToken = Join-Path $previewRoot 'cloudflare-ai.dpapi'
try {
    $tokenText = [IO.File]::ReadAllText($pendingToken).Trim()
    if ($tokenText -notmatch '^[A-Za-z0-9_-]{20,200}$') { throw 'Formato de token inválido.' }
    $secureToken = ConvertTo-SecureString $tokenText -AsPlainText -Force
    $secureToken | ConvertFrom-SecureString | Set-Content -LiteralPath $protectedToken -Encoding ASCII
    Write-Output 'Token protegido pelo Windows para o usuário atual.'
} finally {
    $tokenText = $null
    if (Test-Path -LiteralPath $pendingToken) { Remove-Item -LiteralPath $pendingToken -Force }
}
