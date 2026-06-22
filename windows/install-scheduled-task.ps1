$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "update-and-publish.ps1"
$TaskName = "ACF Meta Vehicle Feed Updater"
$PowerShell = (Get-Command powershell.exe).Source
$Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""

$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments
$Triggers = @(
    New-ScheduledTaskTrigger -Daily -At 12:00am
    New-ScheduledTaskTrigger -Daily -At 6:00am
    New-ScheduledTaskTrigger -Daily -At 12:00pm
    New-ScheduledTaskTrigger -Daily -At 6:00pm
)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Triggers -Settings $Settings -Description "Refreshes the ACF website URLs in the Meta vehicle feed and publishes them to GitHub." -Force | Out-Null

Write-Host "Scheduled task installed: $TaskName" -ForegroundColor Green
Write-Host "It will update and publish the corrected feed every six hours while this computer is available."
