# PowerShell / start-preview-ai.ps1 / Windows + Node.js 22 / IA real somente na prévia local.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$previewRoot = Join-Path $repoRoot '.local-preview'
$credentialPath = Join-Path $previewRoot 'cloudflare-ai.dpapi'
if (!(Test-Path -LiteralPath $credentialPath)) { throw 'O token privado ainda não foi configurado.' }
$secret = (Get-Content -LiteralPath $credentialPath -Raw).Trim() | ConvertTo-SecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
$oldAccount = $env:CLOUDFLARE_ACCOUNT_ID
$oldToken = $env:CLOUDFLARE_API_TOKEN
try {
    $env:CLOUDFLARE_ACCOUNT_ID = '0664a27a6f39fb85af416d5ec5710941'
    $env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $listeners = Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $previewProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess)
        if ($previewProcess.CommandLine -notlike '*scripts/preview-moderation.mjs*') { throw 'A porta 8789 está em uso por outro aplicativo.' }
        Stop-Process -Id $listener.OwningProcess
    }
    Start-Process -FilePath (Get-Command node).Source -ArgumentList 'scripts/preview-moderation.mjs','--vision' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $previewRoot 'server.log') -RedirectStandardError (Join-Path $previewRoot 'server-error.log')
    Write-Output 'Prévia com IA: http://127.0.0.1:8789/'
} finally {
    $env:CLOUDFLARE_API_TOKEN = $oldToken
    $env:CLOUDFLARE_ACCOUNT_ID = $oldAccount
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
}
