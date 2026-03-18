param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  [string]$Message = "chore: sync project",
  [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or not available in PATH."
}

$isRepo = Test-Path ".git"
if (-not $isRepo) {
  Write-Host "Initializing git repository..."
  git init | Out-Host
  git checkout -b $Branch | Out-Host
}

$gitName = git config user.name
$gitEmail = git config user.email
if ([string]::IsNullOrWhiteSpace($gitName) -or [string]::IsNullOrWhiteSpace($gitEmail)) {
  Write-Warning "Git user.name or user.email is not configured. Run: git config --global user.name 'Your Name' and git config --global user.email 'you@example.com'"
}

Write-Host "Staging changes..."
git add -A | Out-Host

$stagedFiles = git diff --cached --name-only
if ($stagedFiles) {
  Write-Host "Creating commit..."
  git commit -m $Message | Out-Host
} else {
  Write-Host "No staged changes to commit."
}

$originUrl = ""
try {
  $originUrl = git remote get-url origin 2>$null
} catch {
  $originUrl = ""
}

if ([string]::IsNullOrWhiteSpace($originUrl)) {
  Write-Host "Adding origin remote..."
  git remote add origin $RepoUrl | Out-Host
} elseif ($originUrl -ne $RepoUrl) {
  Write-Host "Updating origin remote URL..."
  git remote set-url origin $RepoUrl | Out-Host
}

$currentBranch = git rev-parse --abbrev-ref HEAD
if ([string]::IsNullOrWhiteSpace($currentBranch) -or $currentBranch -eq "HEAD") {
  $currentBranch = $Branch
  git checkout -b $currentBranch | Out-Host
}

Write-Host "Pushing to GitHub..."
git push -u origin $currentBranch | Out-Host

Write-Host "Done. Project uploaded to GitHub on branch '$currentBranch'."