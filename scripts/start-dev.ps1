[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tauriCli = Join-Path $projectDir "node_modules\@tauri-apps\cli\tauri.js"
$viteCli = Join-Path $projectDir "node_modules\vite\bin\vite.js"
$mutex = New-Object System.Threading.Mutex($false, "Local\DTFProStudioDevelopmentLauncher")
$ownsMutex = $false

try {
    try {
        $ownsMutex = $mutex.WaitOne(0, $false)
    } catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }

    if (-not $ownsMutex) {
        Write-Host "DTF Pro Studio ya tiene un servidor de desarrollo iniciado." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        exit 0
    }

    try {
        $Host.UI.RawUI.WindowTitle = "DTF Pro Studio - Desarrollo"
    } catch {
        # El titulo es una comodidad; no debe impedir el arranque.
    }

    $nodeCandidates = New-Object System.Collections.Generic.List[string]
    $nodeCandidates.Add((Join-Path $env:ProgramFiles "nodejs\node.exe"))
    $nodeCandidates.Add((Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"))
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -ne $nodeCommand) {
        $nodeCandidates.Add($nodeCommand.Path)
    }
    $nodeCandidates.Add((Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"))

    $nodePath = $nodeCandidates |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
        Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($nodePath)) {
        throw "No se encontro Node.js. Instala Node LTS y vuelve a abrir este acceso directo."
    }
    if (-not (Test-Path -LiteralPath $tauriCli -PathType Leaf)) {
        throw "Falta el CLI local de Tauri. Ejecuta 'corepack pnpm install' una vez en el proyecto."
    }
    if (-not (Test-Path -LiteralPath $viteCli -PathType Leaf)) {
        throw "Falta el Vite local. Ejecuta 'corepack pnpm install' una vez en el proyecto."
    }

    $nodeDir = Split-Path -Parent $nodePath
    $cargoDir = Join-Path $env:USERPROFILE ".cargo\bin"
    $pathEntries = $env:PATH -split ";" | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_) -and
        -not [string]::Equals($_, $nodeDir, [System.StringComparison]::OrdinalIgnoreCase) -and
        -not [string]::Equals($_, $cargoDir, [System.StringComparison]::OrdinalIgnoreCase)
    }
    $preferredPathEntries = New-Object System.Collections.Generic.List[string]
    $preferredPathEntries.Add($nodeDir)
    if (Test-Path -LiteralPath (Join-Path $cargoDir "cargo.exe") -PathType Leaf) {
        $preferredPathEntries.Add($cargoDir)
    }
    $preferredPathEntries.AddRange([string[]]$pathEntries)
    $env:PATH = $preferredPathEntries -join ";"

    Set-Location -LiteralPath $projectDir
    Write-Host ""
    Write-Host "DTF Pro Studio - servidor de desarrollo" -ForegroundColor DarkYellow
    Write-Host "Proyecto: $projectDir"
    Write-Host "Interfaz: http://127.0.0.1:1420"
    Write-Host "Cierra la aplicacion o presiona Ctrl+C para detener el servidor." -ForegroundColor DarkGray
    Write-Host ""

    & $nodePath $tauriCli dev
    if ($LASTEXITCODE -ne 0) {
        throw "Tauri termino con el codigo $LASTEXITCODE."
    }
} catch {
    Write-Host ""
    Write-Host "No se pudo iniciar DTF Pro Studio." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    [void](Read-Host "Presiona Enter para cerrar")
    exit 1
} finally {
    if ($ownsMutex) {
        try {
            $mutex.ReleaseMutex()
        } catch {
            # El proceso puede haber sido interrumpido con Ctrl+C.
        }
    }
    $mutex.Dispose()
}
