$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path -LiteralPath $Node)) {
    throw "The Codex Node runtime was not found at $Node"
}

Set-Location -LiteralPath $ProjectRoot
$env:ACF_BROWSER_VISIBLE = "1"
& $Node "scripts\run-local.mjs"
if ($LASTEXITCODE -ne 0) { throw "The first feed update failed." }

Write-Host ""
Write-Host "First update completed successfully." -ForegroundColor Green
Write-Host "The corrected feed is in public\acf-meta-feed.csv"
