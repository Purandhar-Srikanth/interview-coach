# Build the frontend and start the app on one port (like production): http://localhost:8000
# Usage (from the project folder, PowerShell 7):  & .\scripts\run.ps1
# For development with instant reload instead, run the backend and `npm --prefix frontend run dev`
# in two terminals (see README).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$py = if ($IsWindows) { ".venv\Scripts\python.exe" } else { ".venv/bin/python" }
if (-not (Test-Path $py)) { throw "Run & .\scripts\setup.ps1 first." }

Write-Host "Building the frontend..." -ForegroundColor Cyan
npm --prefix frontend run build --silent

Write-Host "Starting Interview Coach at http://localhost:8000  (Ctrl+C to stop)" -ForegroundColor Green
& $py -m uvicorn app.main:app --app-dir backend --port 8000
