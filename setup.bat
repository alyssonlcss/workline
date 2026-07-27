@echo off
set WT_PATH=%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe
set PROJECT_DIR=%~dp0
set PROJECT_DIR=%PROJECT_DIR:~0,-1%

:: Se nao estiver rodando dentro do Windows Terminal, re-lanca o script dentro dele
if not defined WT_SESSION (
    "%WT_PATH%" -d "%PROJECT_DIR%" --title "Setup" --suppressApplicationTitle cmd /k "%~f0"
    exit /b
)

title Scanner Analytics - Setup
echo ===================================================
echo       Iniciando Setup do Scanner Analytics
echo ===================================================
echo.

:: Verificacao e instalacao do Node.js se necessario (no sistema como um todo)
echo [0/3] Verificando instalacao do Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js nao foi encontrado no sistema.
    echo Iniciando instalacao automatica do Node.js v24.16.0...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\install-node.ps1"
    set "PATH=%USERPROFILE%\Documents\NodeJS;%APPDATA%\npm;%PATH%"
) else (
    echo Node.js ja esta instalado no sistema. Ignorando instalacao...
)

echo.
echo [1/3] Instalando dependencias do Backend...
cd /d "%PROJECT_DIR%\src\backend"
if not exist "node_modules\" (
    set PUPPETEER_SKIP_DOWNLOAD=true
    call npm install
) else (
    echo Dependencias do Backend ja estao instaladas. Ignorando npm install...
)

echo.
echo [2/3] Instalando dependencias do Frontend...
cd /d "%PROJECT_DIR%\src\frontend"
if not exist "node_modules\" (
    call npm install
) else (
    echo Dependencias do Frontend ja estao instaladas. Ignorando npm install...
)

echo.
echo [3/3] Iniciando os servidores...
cd /d "%PROJECT_DIR%"

echo Abrindo abas do Backend e Frontend...
"%WT_PATH%" -w 0 new-tab -d "%PROJECT_DIR%\src\backend" --title "Backend" --suppressApplicationTitle cmd /k "npm run dev"
"%WT_PATH%" -w 0 new-tab -d "%PROJECT_DIR%\src\frontend" --title "Frontend" --suppressApplicationTitle cmd /k "npm start"

exit
