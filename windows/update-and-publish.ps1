$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$LogDirectory = Join-Path $ProjectRoot "logs"
$LogFile = Join-Path $LogDirectory "feed-updater.log"

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
Start-Transcript -Path $LogFile -Append | Out-Null

try {
    if (-not (Test-Path -LiteralPath $Node)) {
        throw "The Codex Node runtime was not found at $Node"
    }

    Set-Location -LiteralPath $ProjectRoot
    Remove-Item Env:ACF_BROWSER_VISIBLE -ErrorAction SilentlyContinue
    & $Node "scripts\run-local.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Feed generation failed; nothing was published." }

    $Git = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "GitHubDesktop") -Filter git.exe -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "resources\\app\\git\\cmd\\git.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $Git) {
        throw "GitHub Desktop's Git was not found. Install GitHub Desktop and publish this folder first."
    }

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
        throw "This folder has not been published as a GitHub repository yet."
    }

    $SafePath = $ProjectRoot.Replace("\", "/")
    & $Git config --global --add safe.directory $SafePath

    & $Git add "public/acf-meta-feed.csv" "public/url-map.json" "public/feed-report.json"
    & $Git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No feed changes to publish."
        exit 0
    }

    & $Git -c user.name="acf-feed-updater" -c user.email="acf-feed-updater@users.noreply.github.com" commit -m "Update corrected vehicle feed"
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }

    & $Git push
    if ($LASTEXITCODE -ne 0) { throw "Git push failed." }

    Write-Host "Corrected feed updated and published." -ForegroundColor Green
}
finally {
    Stop-Transcript | Out-Null
}
