param(
  [string]$Message = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Commit message
if ([string]::IsNullOrWhiteSpace($Message)) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  $Message = "deploy: update $timestamp"
}

# 2. Kill existing backend on port 4000
Write-Host "Stopping any process on port 4000..." -ForegroundColor Cyan
$netstatOutput = netstat -ano 2>$null | Select-String ":4000 "
foreach ($line in $netstatOutput) {
  $parts = ($line.ToString().Trim() -split "\s+")
  $pid = $parts[-1]
  if ($pid -match "^\d+$" -and $pid -ne "0") {
    try { Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Start-Sleep -Milliseconds 500

# 3. Start backend in a new terminal window
Write-Host "Starting backend on port 4000..." -ForegroundColor Cyan
$backendPath = Join-Path $projectRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; npm run dev" -WindowStyle Normal

# 4. Push to GitHub (triggers Vercel auto-deploy)
Write-Host "Pushing to GitHub..." -ForegroundColor Magenta

git add -A

$staged = git diff --cached --name-only
if ($staged) {
  git commit -m $Message
  Write-Host "Committed: $Message" -ForegroundColor Green
} else {
  Write-Host "No changes to commit - pushing existing HEAD." -ForegroundColor Yellow
}

git push

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Backend : http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Frontend: Vercel deploying (check vercel.com/dashboard)" -ForegroundColor Magenta
