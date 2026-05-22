# start.ps1 - Design Pulse Backend Launcher
# Always starts uvicorn on port 8001 to leave 8000 free for Next.js.
# Run from: c:\Users\BUrness\Dev\design-pulse\designpulse-backend\

$ErrorActionPreference = "Stop"

# Activate venv if not already active
$venvActivate = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
    # Verify we are using the virtualenv's Python binary
    $pythonPath = (Get-Command python).Source
    Write-Host "[start] Using Python interpreter: $pythonPath" -ForegroundColor DarkGray
} else {
    Write-Warning "venv not found at $venvActivate - ensure virtualenv is set up."
}

Write-Host "[start] Launching FastAPI on http://127.0.0.1:8001" -ForegroundColor Cyan
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001

