#Requires -Version 5.1
# Local Windows helper: repo-root venv + Django runserver (matches Azure VM layout).
# Prerequisites: Docker Desktop running; from emotion_chat: docker compose up -d
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvDir = Join-Path $RepoRoot ".venv"
$BackendDir = Join-Path $RepoRoot "emotion_chat"

if (-not (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
    Write-Host "Creating virtualenv at $VenvDir ..."
    python -m venv $VenvDir
}

$py = Join-Path $VenvDir "Scripts\python.exe"
$pip = Join-Path $VenvDir "Scripts\pip.exe"

& $pip install --upgrade pip | Out-Null
& $pip install -r (Join-Path $RepoRoot "emotion_chat\requirements.txt")

Set-Location $BackendDir
Write-Host "Applying migrations..."
& $py manage.py migrate --noinput
Write-Host "Starting development server (Ctrl+C to stop)..."
& $py manage.py runserver
