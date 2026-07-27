# 1. Definir caminhos e versão especificada
$NodeVersion = "v24.16.0"
$ZipUrl = "https://nodejs.org/dist/v24.16.0/node-v24.16.0-win-x64.zip"
$InstallDir = "$HOME\Documents\NodeJS"
$NpmGlobalPath = "$env:APPDATA\npm"
$TempZip = "$env:TEMP\node.zip"
$TempExtract = "$env:TEMP\node_extract"
 
Write-Host "1. Removendo instalações anteriores para evitar conflitos..." -ForegroundColor Cyan
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
# Remove a versão antiga fora de Documentos se ainda existir
$OldInstallDir = "$HOME\NodeJS"
if (Test-Path $OldInstallDir) { Remove-Item $OldInstallDir -Recurse -Force }
 
Write-Host "2. Baixando o Node.js $NodeVersion..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip
 
Write-Host "3. Extraindo os arquivos..." -ForegroundColor Cyan
if (Test-Path $TempExtract) { Remove-Item $TempExtract -Recurse -Force }
Expand-Archive -Path $TempZip -DestinationPath $TempExtract
 
Write-Host "4. Movendo para a pasta Documentos ($InstallDir)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $InstallDir -Force
Move-Item -Path "$TempExtract\node-$NodeVersion-win-x64\*" -Destination $InstallDir -Force
 
Write-Host "5. Limpando arquivos temporários..." -ForegroundColor Cyan
Remove-Item $TempZip -Force
Remove-Item $TempExtract -Recurse -Force
 
Write-Host "6. Criando pasta global do NPM se necessário..." -ForegroundColor Cyan
if (-not (Test-Path $NpmGlobalPath)) { New-Item -ItemType Directory -Path $NpmGlobalPath -Force }
 
Write-Host "7. Configurando o PATH do Usuário permanentemente..." -ForegroundColor Cyan
# Obter PATH atual
$UserPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
$PathList = if ($UserPath) { $UserPath.Split(';') } else { @() }
 
# Limpar o PATH antigo e entradas vazias
$CleanedPathList = @()
foreach ($p in $PathList) {
    $trimmed = $p.Trim()
    if ($trimmed -ne "" -and $trimmed -ne $OldInstallDir) {
        $CleanedPathList += $trimmed
    }
}
 
# Adicionar os novos caminhos
if ($CleanedPathList -notcontains $InstallDir) {
    $CleanedPathList += $InstallDir
}
if ($CleanedPathList -notcontains $NpmGlobalPath) {
    $CleanedPathList += $NpmGlobalPath
}
 
# Unir novamente e salvar permanentemente
$UpdatedPath = [string]::Join(";", $CleanedPathList)
[Environment]::SetEnvironmentVariable("PATH", $UpdatedPath, [EnvironmentVariableTarget]::User)
 
# Atualizar o PATH apenas para a sessão atual para testar imediatamente
$env:PATH = "$UpdatedPath;$env:PATH"
