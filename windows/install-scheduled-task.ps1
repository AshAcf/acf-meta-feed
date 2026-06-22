$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "update-and-publish.ps1"
$TaskName = "ACF Meta Vehicle Feed Updater"
$PowerShell = (Get-Command powershell.exe).Source
$TaskCommand = "`"$PowerShell`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""

& schtasks.exe /Create /TN $TaskName /TR $TaskCommand /SC HOURLY /MO 6 /F
if ($LASTEXITCODE -ne 0) { throw "Windows could not create the scheduled task." }

Write-Host "Scheduled task installed: $TaskName" -ForegroundColor Green
Write-Host "It will update and publish the corrected feed every six hours while this computer is available."
