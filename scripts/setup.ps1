# One-time setup: Python virtual environment, backend + frontend packages, and a .env file.
# Usage (from the project folder, PowerShell 7):  & .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "1/3 Python packages..." -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { python -m venv .venv }
$py = if ($IsWindows) { ".venv\Scripts\python.exe" } else { ".venv/bin/python" }
& $py -m pip install --quiet --upgrade pip
& $py -m pip install --quiet -r backend/requirements-dev.txt

Write-Host "2/3 Frontend packages..." -ForegroundColor Cyan
npm --prefix frontend ci --silent

Write-Host "3/3 Settings (.env)..." -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    # Start in mock mode so everything works with no API key and no cost.
    Set-Content -Path ".env" -Value "LLM_MODE=mock" -Encoding utf8NoBOM
    Write-Host "    Created .env in mock mode. For real AI: & .\scripts\set_openai_key.ps1"
} else {
    Write-Host "    .env already exists; left unchanged."
}

Write-Host "Done. Start the app with:  & .\scripts\run.ps1" -ForegroundColor Green
