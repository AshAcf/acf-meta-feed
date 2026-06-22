param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryUrl
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Git = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "GitHubDesktop") -Filter git.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "resources\\app\\git\\cmd\\git.exe$" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $Git) {
    throw "GitHub Desktop's Git was not found. Install GitHub Desktop and sign in first."
}

Set-Location -LiteralPath $ProjectRoot
$SafePath = $ProjectRoot.Replace("\", "/")
& $Git config --global --add safe.directory $SafePath
if ($LASTEXITCODE -ne 0) { throw "The project folder could not be added to Git's trusted directory list." }

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
    & $Git init
    if ($LASTEXITCODE -ne 0) { throw "Git repository setup failed." }
}

& $Git checkout -B main
& $Git add .
& $Git -c user.name="Avon City Ford" -c user.email="acf-feed-updater@users.noreply.github.com" commit -m "Set up corrected ACF Meta feed"

$Remotes = @(& $Git remote)
if ($Remotes -contains "origin") { & $Git remote remove origin }
& $Git remote add origin $RepositoryUrl
if ($LASTEXITCODE -ne 0) { throw "The GitHub repository URL could not be added." }

& $Git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "The initial GitHub push failed. Confirm GitHub Desktop is signed in and the repository URL is correct." }

Write-Host "Project connected and published to GitHub." -ForegroundColor Green
