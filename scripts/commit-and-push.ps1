# Commits whatever's currently changed and pushes it to the current branch's remote.
#
#   .\scripts\commit-and-push.ps1 "Your commit message"

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message
)

$ErrorActionPreference = 'Stop'

Write-Host "`n== git status ==" -ForegroundColor Cyan
git status

Write-Host "`n== staging changes ==" -ForegroundColor Cyan
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "`nNothing staged -- nothing to commit." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n== files to be committed ==" -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host "  $_" }

Write-Host "`n== committing ==" -ForegroundColor Cyan
git commit -m $Message

Write-Host "`n== pushing ==" -ForegroundColor Cyan
git push

Write-Host "`nDone." -ForegroundColor Green
