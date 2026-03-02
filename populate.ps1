$BACKEND = "https://steamsense-backend.onrender.com"

Write-Host "=== SteamSense - Poblando base de datos ===" -ForegroundColor Cyan
Write-Host "Deja esta ventana abierta." -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/3] Iniciando sync de top 500 juegos..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$BACKEND/sync/top?top_n=500" -Method POST
    Write-Host "      OK: $($r.message)" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "      Esperando 6 minutos..." -ForegroundColor Yellow

for ($i = 360; $i -gt 0; $i--) {
    $mins = [math]::Floor($i/60)
    $secs = $i % 60
    Write-Progress -Activity "Esperando sync..." -Status "$mins min $secs seg" -PercentComplete ((360-$i)/360*100)
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "[2/3] Generando predicciones ML..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$BACKEND/sync/predictions?limit=1000" -Method POST
    Write-Host "      OK: $($r.message)" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "      Esperando 3 minutos..." -ForegroundColor Yellow

for ($i = 180; $i -gt 0; $i--) {
    $mins = [math]::Floor($i/60)
    $secs = $i % 60
    Write-Progress -Activity "Generando predicciones..." -Status "$mins min $secs seg" -PercentComplete ((180-$i)/180*100)
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "[3/3] Verificando resultado..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$BACKEND/games?limit=1&offset=0" -Method GET
    Write-Host "      Juegos en DB: $($r.total)" -ForegroundColor Green
} catch {
    Write-Host "      No se pudo verificar, pero el sync ya corrio." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== LISTO ===" -ForegroundColor Green
Write-Host "Recarga tu app en Vercel - deberias ver los juegos." -ForegroundColor Cyan
