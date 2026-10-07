$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$mutex = New-Object System.Threading.Mutex($false, 'Local\BigCalGitHubSync')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
    if (Test-Path '.git/MERGE_HEAD') { throw 'Finish the Git merge before syncing.' }
    $branch = git branch --show-current
    if ($branch -ne 'main') { throw 'Automatic sync only runs on main.' }
    $changes = git status --porcelain --untracked-files=no
    if ($changes) {
        npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw 'Tests failed; changes were not pushed.' }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed; changes were not pushed.' }
        git add -u
        if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
        git commit -m "Automatically save BigCal changes"
        if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Check authentication or remote changes; no force push is used.' }
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
