@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Payment Simulator - Instalador Windows
echo ============================================
echo.

:: Verificar si Git está instalado
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no está instalado.
    echo Por favor, instala Git desde: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado.
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
echo [INFO] npm version:
npm --version
echo.

:: Definir directorio de instalación
set "INSTALL_DIR=%USERPROFILE%\PaymentSimulator"

:: Preguntar si quiere usar otro directorio
echo El simulador se instalara en: %INSTALL_DIR%
set /p "CUSTOM_DIR=Presiona Enter para continuar o escribe otra ruta: "
if not "!CUSTOM_DIR!"=="" set "INSTALL_DIR=!CUSTOM_DIR!"

:: Verificar si el directorio ya existe
if exist "%INSTALL_DIR%\Payments Simulator" (
    echo.
    echo [INFO] El directorio ya existe. Actualizando...
    cd /d "%INSTALL_DIR%\Payments Simulator"
    git pull
    goto :install_deps
)

:: Crear directorio si no existe
if not exist "%INSTALL_DIR%" (
    echo [INFO] Creando directorio: %INSTALL_DIR%
    mkdir "%INSTALL_DIR%"
)

:: Clonar repositorio
echo.
echo [INFO] Clonando repositorio...
cd /d "%INSTALL_DIR%"
git clone https://github.com/slganimedes/Payments-simulator.git "Payments Simulator"
if %errorlevel% neq 0 (
    echo [ERROR] Error al clonar el repositorio.
    pause
    exit /b 1
)

cd /d "%INSTALL_DIR%\Payments Simulator"

:install_deps
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
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] npm rebuild tuvo problemas, pero continuamos...
)

:: Construir frontend
echo.
echo [INFO] Construyendo frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Error al construir el frontend.
    pause
    exit /b 1
)

:: Iniciar servidor
echo.
echo ============================================
echo   Iniciando Payment Simulator...
echo ============================================
echo.
echo La aplicacion estara disponible en:
echo   http://localhost:10100
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.

call npm start

pause
