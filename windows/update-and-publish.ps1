param([switch]$NoPublish)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$LogDirectory = Join-Path $ProjectRoot "logs"
$LogFile = Join-Path $LogDirectory "feed-updater.log"

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
Start-Transcript -Path $LogFile -Append | Out-Null

try {
    if (-not (Test-Path -LiteralPath $Node)) {
        $NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($NodeCommand) {
            $Node = $NodeCommand.Source
        }
    }

    if (-not $Node -or -not (Test-Path -LiteralPath $Node)) {
        $Node = Get-ChildItem -Path (Join-Path $env:USERPROFILE ".cache\codex-runtimes") -Filter node.exe -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "dependencies\\node\\bin\\node.exe$" } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName
    }

    if (-not $Node -or -not (Test-Path -LiteralPath $Node)) {
        throw "The Codex Node runtime was not found."
    }

    $Git = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "GitHubDesktop") -Filter git.exe -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "resources\\app\\git\\cmd\\git.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $Git) {
        $Git = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
    }
    if (-not $Git) {
        $Git = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
    }
    if (-not (Test-Path -LiteralPath $Git)) {
        throw 'Git was not found. Install Git before publishing.'
    }

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
        throw "This folder has not been published as a GitHub repository yet."
    }

    $SafePath = $ProjectRoot.Replace("\", "/")
    & $Git config --global --add safe.directory $SafePath

    Set-Location -LiteralPath $ProjectRoot

    # Sync before generating files. Pulling after generation can make autostash
    # restore conflicts into generated JSON and accidentally publish them.
    & $Git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Git sync failed. Open GitHub Desktop and resolve the pending repository update."
    }

    $Unmerged = & $Git diff --name-only --diff-filter=U
    if ($LASTEXITCODE -ne 0 -or $Unmerged) {
        throw "Git has unresolved files. Nothing was generated or published."
    }

    Remove-Item Env:ACF_BROWSER_VISIBLE -ErrorAction SilentlyContinue
    & $Node "scripts\run-all-local.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Feed generation failed; nothing was published." }

    if ($NoPublish) {
        Write-Host 'Manual test complete. Local feeds generated; nothing published.'
        return
    }

    $ConflictMarkers = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'public') -File |
        Where-Object { $_.Name -match '(report\.json|url-map\.json|\.csv)$' } |
        Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)' -List
    if ($ConflictMarkers) {
        throw "Generated feed files contain Git conflict markers. Nothing was published."
    }

    & $Git add -- 'public/*.csv' 'public/*report.json' 'public/*url-map.json' 'public/images/hybrid-vehicles/*.jpg'
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage generated feeds.' }
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
