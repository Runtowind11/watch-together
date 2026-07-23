param(
  [switch]$Dev
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 释放端口 3001
$oldPid = netstat -ano | Select-String ":3001 " | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1
if ($oldPid -and $oldPid -ne "0") {
  Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

if ($Dev) {
  Write-Host "=== DEV MODE ===" -ForegroundColor Cyan
  Start-Process powershell -WorkingDirectory "$root\server" -ArgumentList "-NoExit npx tsx watch src\index.ts"
  Start-Process powershell -WorkingDirectory "$root\client" -ArgumentList "-NoExit npx vite --host"
  Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
  Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
} else {
  Write-Host "=== PRODUCTION MODE ===" -ForegroundColor Cyan
  Write-Host "Building frontend..." -ForegroundColor Yellow
  Set-Location "$root\client"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
  }
  Write-Host "Starting server..." -ForegroundColor Yellow
  Start-Process powershell -WorkingDirectory "$root\server" -ArgumentList "-NoExit", "-Command", "`$env:NODE_ENV='production'; npx tsx src\index.ts"
  Write-Host "Server started" -ForegroundColor Cyan
  Write-Host "Access via: http://localhost:3001 or http://<tailscale-ip>:3001" -ForegroundColor Cyan
}
