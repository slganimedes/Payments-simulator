@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Payment Simulator - Instalador Windows
echo ============================================
echo.

:: Verificar si Git está instalado
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no esta instalado.
    echo Por favor, instala Git desde: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor, instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

:: Mostrar versiones
echo [INFO] Git version:
git --version
echo.
echo [INFO] Node.js version:
node --version
echo.

:: Detectar si estamos dentro del proyecto (el script está junto a simulator-project/)
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%simulator-project\package.json" (
    echo [INFO] Proyecto detectado en %SCRIPT_DIR%
    set "PROJECT_DIR=%SCRIPT_DIR%simulator-project"
    goto :install_deps
)

:: Si no estamos en el proyecto, clonar o actualizar
set "INSTALL_DIR=%USERPROFILE%\PaymentSimulator"

if exist "%INSTALL_DIR%\simulator-project\package.json" (
    echo [INFO] El directorio ya existe. Actualizando...
    cd /d "%INSTALL_DIR%"
    git pull
    set "PROJECT_DIR=%INSTALL_DIR%\simulator-project"
    goto :install_deps
)

:: Clonar repositorio
echo.
echo [INFO] Clonando repositorio en %INSTALL_DIR%...
git clone https://github.com/slganimedes/Payments-simulator.git "%INSTALL_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Error al clonar el repositorio.
    pause
    exit /b 1
)

set "PROJECT_DIR=%INSTALL_DIR%\simulator-project"

:install_deps
cd /d "%PROJECT_DIR%"
echo.
echo [INFO] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias.
    pause
    exit /b 1
)

:: Rebuild para módulos nativos (better-sqlite3)
echo.
echo [INFO] Reconstruyendo modulos nativos...
call npm rebuild

:: Iniciar servidor en modo desarrollo
echo.
echo ============================================
echo   Iniciando Payment Simulator (dev mode)
echo ============================================
echo.
echo La aplicacion estara disponible en:
echo   http://localhost:10100
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.

call npm run dev
