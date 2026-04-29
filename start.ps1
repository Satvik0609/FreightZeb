# FreightZen — One-Click Startup Script (Windows PowerShell)
# Run this from the project root:  .\start.ps1
#
# Opens 3 new PowerShell windows:
#   1. Backend  (http://localhost:5000)
#   2. ML Service (http://localhost:8000)
#   3. Frontend (http://localhost:5173)

$root = $PSScriptRoot

Write-Host ""
Write-Host "=== FreightZen Startup ===" -ForegroundColor Cyan

# ── 1. Kill any stale node processes (fixes EPERM on prisma DLL) ──────────────
Write-Host ""
Write-Host "[1/3] Clearing stale Node processes..." -ForegroundColor Yellow
try {
    $nodes = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodes) {
        $nodes | Stop-Process -Force
        Write-Host "      Killed $($nodes.Count) stale node process(es)" -ForegroundColor Gray
        Start-Sleep -Seconds 1
    } else {
        Write-Host "      No stale node processes found" -ForegroundColor Gray
    }
} catch {}

# ── 2. Start Backend ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Starting Backend (http://localhost:5000)..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; Write-Host 'Installing backend deps...' -ForegroundColor Cyan; npm install --silent; Write-Host 'Starting backend...' -ForegroundColor Green; npm start" -WindowStyle Normal

# ── 3. Start ML Service ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Starting ML Service (http://localhost:8000)..." -ForegroundColor Yellow
$mlDir = Join-Path $root "ml\service"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$mlDir'; Write-Host 'Starting ML service...' -ForegroundColor Cyan; python -m uvicorn app:app --host 127.0.0.1 --port 8000" -WindowStyle Normal

# ── 4. Start Frontend ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Starting Frontend (http://localhost:5173)..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; Write-Host 'Installing frontend deps...' -ForegroundColor Cyan; npm install --silent; Write-Host 'Starting frontend...' -ForegroundColor Green; npm run dev" -WindowStyle Normal

# ── Done ───────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== All 3 services starting in separate windows ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Wait ~20 seconds, then open:  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login credentials:"
Write-Host "    Admin     → admin@freightzen.in        / Admin@1234"
Write-Host "    Warehouse → ops@bharat-logistics.in    / Warehouse@1234"
Write-Host "    Dealer    → fleet@rajesh-transport.in  / Dealer@1234"
Write-Host ""
