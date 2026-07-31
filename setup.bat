@echo off
set WT_PATH=%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe
set PROJECT_DIR=%~dp0
set PROJECT_DIR=%PROJECT_DIR:~0,-1%

:: Se nao estiver rodando dentro do Windows Terminal, re-lanca o script dentro dele
if not defined WT_SESSION (
    if exist "%WT_PATH%" (
        "%WT_PATH%" -d "%PROJECT_DIR%" --title "Scanner Analytics Setup" --suppressApplicationTitle cmd /k "%~f0"
        exit /b
    )
)

:MENU
cls
echo ===================================================
echo          Scanner Analytics - Menu Setup
echo ===================================================
echo.
echo  1 - Executar (Iniciar Backend e Frontend)
echo  2 - Configurar / Alterar credenciais e link Spotfire (.env)
echo  3 - Instalar / Resetar dependencias e Executar
echo  4 - Sair
echo.
echo ===================================================
set /p CHOICE="Escolha uma opcao [1-4]: "

if "%CHOICE%"=="1" goto EXECUTAR
if "%CHOICE%"=="2" goto CONFIGURAR_ENV
if "%CHOICE%"=="3" goto INSTALAR_DEPENDENCIAS
if "%CHOICE%"=="4" goto SAIR

echo.
echo Opcao invalida! Tente novamente.
timeout /t 2 >nul
goto MENU


:: ===================================================
:: OPCAO 1: EXECUTAR
:: ===================================================
:EXECUTAR
cls
echo ===================================================
echo             Iniciando Scanner Analytics
echo ===================================================
echo.

:: 1. Verificar se .env existe ou se faltam credenciais basicas
if not exist "%PROJECT_DIR%\src\backend\.env" (
    echo [.env] Arquivo de configuracao nao encontrado. Criando src\backend\.env...
    copy /y "%PROJECT_DIR%\src\backend\.env.example" "%PROJECT_DIR%\src\backend\.env" >nul
    echo.
    call :PROMPT_ENV
) else (
    :: Verificar se SPOTFIRE_USERNAME ou SPOTFIRE_ANALYSIS_URL estao vazios
    findstr /r /c:"^SPOTFIRE_USERNAME=." "%PROJECT_DIR%\src\backend\.env" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [.env] Credenciais nao configuradas. Iniciando configuracao inicial...
        echo.
        call :PROMPT_ENV
    )
)

:: 2. Garantir instalacao basica de node_modules se ausentes
if not exist "%PROJECT_DIR%\src\backend\node_modules\" (
    echo [AVISO] Dependencias do Backend ausentes. Instalando...
    cd /d "%PROJECT_DIR%\src\backend"
    set PUPPETEER_SKIP_DOWNLOAD=true
    call npm install
)

if not exist "%PROJECT_DIR%\src\frontend\node_modules\" (
    echo [AVISO] Dependencias do Frontend ausentes. Instalando...
    cd /d "%PROJECT_DIR%\src\frontend"
    call npm install
)

cd /d "%PROJECT_DIR%"

:: 3. Iniciar servidores em novas abas do Windows Terminal (ou janelas CMD)
echo.
echo Iniciando servidores (Backend e Frontend)...
if exist "%WT_PATH%" (
    "%WT_PATH%" -w 0 new-tab -d "%PROJECT_DIR%\src\backend" --title "Backend" --suppressApplicationTitle cmd /k "npm run dev"
    "%WT_PATH%" -w 0 new-tab -d "%PROJECT_DIR%\src\frontend" --title "Frontend" --suppressApplicationTitle cmd /k "npm start"
) else (
    start "Backend" /d "%PROJECT_DIR%\src\backend" cmd /k "npm run dev"
    start "Frontend" /d "%PROJECT_DIR%\src\frontend" cmd /k "npm start"
)

echo.
echo ===================================================
echo  Servidores iniciados!
echo  Backend:  http://localhost:3000
echo  Frontend: http://localhost:4200
echo ===================================================
echo.
pause
goto MENU


:: ===================================================
:: OPCAO 2: CONFIGURAR / ALTERAR CREDENCIAIS E LINK SPOTFIRE
:: ===================================================
:CONFIGURAR_ENV
cls
call :PROMPT_ENV
pause
goto MENU


:: ===================================================
:: HELPER: PROMPT E ATUALIZACAO DO .ENV VIA POWERSHELL
:: ===================================================
:PROMPT_ENV
powershell -NoProfile -ExecutionPolicy Bypass -Command "$envPath = Join-Path '%PROJECT_DIR%' 'src\backend\.env'; $exPath = Join-Path '%PROJECT_DIR%' 'src\backend\.env.example'; if (-not (Test-Path $envPath) -and (Test-Path $exPath)) { Copy-Item $exPath $envPath }; Write-Host '===================================================' -ForegroundColor Cyan; Write-Host '       Configuracao de Acesso ao Spotfire' -ForegroundColor Cyan; Write-Host '===================================================' -ForegroundColor Cyan; Write-Host ''; $currentAnalysisUrl = ''; $currentUsername = ''; if (Test-Path $envPath) { Get-Content $envPath | ForEach-Object { if ($_ -match '^SPOTFIRE_ANALYSIS_URL=(.*)') { $currentAnalysisUrl = $matches[1] }; if ($_ -match '^SPOTFIRE_USERNAME=(.*)') { $currentUsername = $matches[1] } } }; Write-Host '1. Link do Spotfire onde estao os dados do Scanner (SPOTFIRE_ANALYSIS_URL):' -ForegroundColor Yellow; if ($currentAnalysisUrl) { Write-Host ('   [Atual: ' + $currentAnalysisUrl + ']') -ForegroundColor Gray; $url = Read-Host '   Digite o novo link (ou pressione ENTER para manter)'; if ([string]::IsNullOrWhiteSpace($url)) { $url = $currentAnalysisUrl } } else { $url = Read-Host '   Cole o link da analise do Spotfire' }; Write-Host ''; Write-Host '2. Matricula / Usuario Spotfire (SPOTFIRE_USERNAME):' -ForegroundColor Yellow; if ($currentUsername) { Write-Host ('   [Atual: ' + $currentUsername + ']') -ForegroundColor Gray; $u = Read-Host '   Digite a matricula / usuario (ou pressione ENTER para manter)'; if ([string]::IsNullOrWhiteSpace($u)) { $u = $currentUsername } } else { $u = Read-Host '   Digite a matricula / usuario' }; Write-Host ''; Write-Host '3. Senha Spotfire (SPOTFIRE_PASSWORD):' -ForegroundColor Yellow; $p = Read-Host '   Digite a senha'; $lines = Get-Content $envPath; $hasUrl = $false; $hasU = $false; $hasP = $false; for ($i=0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '^SPOTFIRE_ANALYSIS_URL=') { $lines[$i] = 'SPOTFIRE_ANALYSIS_URL=' + $url; $hasUrl = $true }; if ($lines[$i] -match '^SPOTFIRE_USERNAME=') { $lines[$i] = 'SPOTFIRE_USERNAME=' + $u; $hasU = $true }; if ($lines[$i] -match '^SPOTFIRE_PASSWORD=') { $lines[$i] = 'SPOTFIRE_PASSWORD=' + $p; $hasP = $true } }; if (-not $hasUrl) { $lines += ('SPOTFIRE_ANALYSIS_URL=' + $url) }; if (-not $hasU) { $lines += ('SPOTFIRE_USERNAME=' + $u) }; if (-not $hasP) { $lines += ('SPOTFIRE_PASSWORD=' + $p) }; [System.IO.File]::WriteAllLines($envPath, $lines, (New-Object System.Text.UTF8Encoding $false)); Write-Host ''; Write-Host '[SUCESSO] Configuracoes salvas em src\backend\.env!' -ForegroundColor Green"
exit /b


:: ===================================================
:: OPCAO 3: INSTALAR / RESETAR DEPENDENCIAS
:: ===================================================
:INSTALAR_DEPENDENCIAS
cls
echo ===================================================
echo      Instalar / Resetar Dependencias e Node.js
echo ===================================================
echo.

echo [1/3] Verificando instalacao e funcionamento do Node.js...
set "PATH=%USERPROFILE%\Documents\NodeJS;%APPDATA%\npm;%PATH%"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js nao foi encontrado no PATH.
    echo Iniciando instalacao automatica do Node.js...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\install-node.ps1"
    set "PATH=%USERPROFILE%\Documents\NodeJS;%APPDATA%\npm;%PATH%"
)

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Falha ao executar 'node -v'. Reinstalando Node.js...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\install-node.ps1"
    set "PATH=%USERPROFILE%\Documents\NodeJS;%APPDATA%\npm;%PATH%"
)

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO CRITICO] Nao foi possivel executar o Node.js.
    echo Por favor, instale o Node.js manualmente em https://nodejs.org
    pause
    goto MENU
)

for /f "delims=" %%v in ('node -v 2^>nul') do set NODE_VERSION=%%v
for /f "delims=" %%v in ('npm -v 2^>nul') do set NPM_VERSION=%%v
echo [OK] Node.js %NODE_VERSION% e npm %NPM_VERSION% estao operacionais!

echo.
echo [2/3] Instalando dependencias do Backend (src\backend)...
cd /d "%PROJECT_DIR%\src\backend"
set PUPPETEER_SKIP_DOWNLOAD=true
call npm install
if %errorlevel% neq 0 (
    echo [AVISO] Houve um problema na instalacao das dependencias do Backend.
) else (
    echo [OK] Dependencias do Backend instaladas com sucesso.
)

echo.
echo [3/3] Instalando dependencias do Frontend (src\frontend)...
cd /d "%PROJECT_DIR%\src\frontend"
call npm install
if %errorlevel% neq 0 (
    echo [AVISO] Houve um problema na instalacao das dependencias do Frontend.
) else (
    echo [OK] Dependencias do Frontend instaladas com sucesso.
)

cd /d "%PROJECT_DIR%"
echo.
echo ===================================================
echo  Instalacao / Reset de dependencias concluido!
echo  A aplicacao sera iniciada automaticamente...
echo ===================================================
echo.
timeout /t 3 >nul
goto EXECUTAR


:: ===================================================
:: OPCAO 4: SAIR
:: ===================================================
:SAIR
exit
