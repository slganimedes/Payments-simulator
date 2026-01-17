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

# Verificar npm
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm no esta disponible." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""

# Directorio de instalación
$defaultDir = "$env:USERPROFILE\PaymentSimulator"
Write-Host "Directorio de instalacion predeterminado: $defaultDir" -ForegroundColor White
$customDir = Read-Host "Presiona Enter para usar este directorio o escribe otra ruta"

if ($customDir -ne "") {
    $installDir = $customDir
} else {
    $installDir = $defaultDir
}

$repoDir = Join-Path $installDir "Payments Simulator"

# Verificar si ya existe
if (Test-Path $repoDir) {
    Write-Host ""
    Write-Host "[INFO] El directorio ya existe. Actualizando..." -ForegroundColor Yellow
    Set-Location $repoDir
    git pull
} else {
    # Crear directorio
    if (-not (Test-Path $installDir)) {
        Write-Host "[INFO] Creando directorio: $installDir" -ForegroundColor White
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    # Clonar repositorio
    Write-Host ""
    Write-Host "[INFO] Clonando repositorio..." -ForegroundColor White
    Set-Location $installDir
    git clone "https://github.com/slganimedes/Payments-simulator.git" "Payments Simulator"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Error al clonar el repositorio." -ForegroundColor Red
        Read-Host "Presiona Enter para salir"
        exit 1
    }

    Set-Location $repoDir
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

# Construir frontend
Write-Host ""
Write-Host "[INFO] Construyendo frontend..." -ForegroundColor White
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al construir el frontend." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Iniciar servidor
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Iniciando Payment Simulator..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La aplicacion estara disponible en:" -ForegroundColor White
Write-Host "  http://localhost:10100" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor." -ForegroundColor Yellow
Write-Host ""

npm start
