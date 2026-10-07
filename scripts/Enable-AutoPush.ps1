$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'Sync-GitHub.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory (Split-Path $PSScriptRoot -Parent)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
Register-ScheduledTask -TaskName 'BigCal GitHub Auto Push' -Action $action -Trigger $trigger -Settings $settings -Description 'Test, build, commit and push tracked BigCal changes every five minutes while signed in.' -Force
