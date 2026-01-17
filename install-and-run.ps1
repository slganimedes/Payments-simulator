# Payment Simulator - Instalador PowerShell para Windows
# Ejecutar con: powershell -ExecutionPolicy Bypass -File install-and-run.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Payment Simulator - Instalador Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Git
try {
    $gitVersion = git --version
    Write-Host "[OK] $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Git no esta instalado." -ForegroundColor Red
    Write-Host "Por favor, instala Git desde: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js no esta instalado." -ForegroundColor Red
    Write-Host "Por favor, instala Node.js desde: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""

# Directorio de instalación
$installDir = "$env:USERPROFILE\PaymentSimulator"

# Verificar si ya existe
if (Test-Path $installDir) {
    Write-Host "[INFO] El directorio ya existe. Actualizando..." -ForegroundColor Yellow
    Set-Location $installDir
    git pull
} else {
    # Clonar repositorio
    Write-Host "[INFO] Clonando repositorio en $installDir..." -ForegroundColor White
    git clone "https://github.com/slganimedes/Payments-simulator.git" $installDir

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Error al clonar el repositorio." -ForegroundColor Red
        Read-Host "Presiona Enter para salir"
        exit 1
    }

    Set-Location $installDir
}

# Instalar dependencias
Write-Host ""
Write-Host "[INFO] Instalando dependencias..." -ForegroundColor White
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al instalar dependencias." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Rebuild módulos nativos
Write-Host ""
Write-Host "[INFO] Reconstruyendo modulos nativos (better-sqlite3)..." -ForegroundColor White
npm rebuild

# Iniciar servidor en modo desarrollo
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Iniciando Payment Simulator (dev mode)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La aplicacion estara disponible en:" -ForegroundColor White
Write-Host "  http://localhost:10100" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor." -ForegroundColor Yellow
Write-Host ""

npm run dev
