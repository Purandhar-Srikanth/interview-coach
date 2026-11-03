# Saves your OpenAI API key into the project's .env file (which is gitignored).
# The key is typed/pasted with hidden input: it is never shown, logged or kept in history.
# Usage (from the project folder):  & .\scripts\set_openai_key.ps1

$envFile = Join-Path $PSScriptRoot "..\.env"

$secure = Read-Host "Paste your OpenAI API key (input is hidden), then press Enter" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $key.StartsWith("sk-")) {
    Write-Host "That doesn't look like an OpenAI key (it should start with 'sk-'). Nothing was saved." -ForegroundColor Red
    exit 1
}

# Keep any other settings already in .env; replace only these two.
# @( ) keeps this a list even when only one line is left; otherwise PowerShell would turn it
# into a single string and the lines below would be glued onto it.
$lines = @()
if (Test-Path $envFile) {
    $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch '^(LLM_MODE|OPENAI_API_KEY)=' })
}
$lines += "LLM_MODE=openai"
$lines += "OPENAI_API_KEY=$key"
Set-Content -Path $envFile -Value $lines -Encoding utf8NoBOM

Write-Host "Saved. .env now uses the real OpenAI models (key length: $($key.Length) characters)." -ForegroundColor Green
