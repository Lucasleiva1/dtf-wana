[CmdletBinding()]
param(
    [string]$DestinationDirectory = [Environment]::GetFolderPath("Desktop")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$launcherPath = Join-Path $projectDir "scripts\start-dev.ps1"
$iconPath = Join-Path $projectDir "src-tauri\icons\icon.ico"
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcutPath = Join-Path $DestinationDirectory "DTF Pro Studio - Desarrollo.lnk"

if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw "No se encontro el lanzador: $launcherPath"
}
if (-not (Test-Path -LiteralPath $DestinationDirectory -PathType Container)) {
    throw "No existe la carpeta de destino: $DestinationDirectory"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Inicia DTF Pro Studio con Vite y Tauri en modo desarrollo"
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Acceso directo creado:" -ForegroundColor Green
Write-Host $shortcutPath
