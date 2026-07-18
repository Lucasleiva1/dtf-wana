[CmdletBinding()]
param(
  [string]$Version,
  [string]$Repository = "Lucasleiva1/dtf-wana",
  [string]$ReleaseNotes,
  [string]$ReleaseNotesFile
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "`n==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label falló con código $LASTEXITCODE."
  }
}

function Get-CargoPackageVersion {
  $match = Select-String -Path "src-tauri/Cargo.toml" -Pattern '^version\s*=\s*"([^"]+)"' | Select-Object -First 1
  if (-not $match) {
    throw "No se encontró la versión en src-tauri/Cargo.toml."
  }
  return $match.Matches[0].Groups[1].Value
}

function Get-GitHubTokenFromCredentialManager {
  $credentialInput = "protocol=https`nhost=github.com`n`n"
  $credentialData = $credentialInput | git credential fill
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar Git Credential Manager."
  }

  $tokenLine = $credentialData | Where-Object { $_ -match '^password=' } | Select-Object -First 1
  if (-not $tokenLine) {
    throw "No hay una credencial de GitHub disponible."
  }

  return ($tokenLine -replace '^password=', '')
}

$packageVersion = (Get-Content "package.json" -Raw | ConvertFrom-Json).version
if (-not $Version) {
  $Version = $packageVersion
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "La versión debe tener formato X.Y.Z."
}

$tauriVersion = (Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json).version
$cargoVersion = Get-CargoPackageVersion
$specVersionMatch = Select-String -Path "docs/ai/APP_SPEC.yaml" -Pattern '^\s+version:\s*["'']?([^"'']+)' | Select-Object -First 1
$specVersion = if ($specVersionMatch) { $specVersionMatch.Matches[0].Groups[1].Value.Trim() } else { $null }
$versions = [ordered]@{
  "package.json" = $packageVersion
  "src-tauri/Cargo.toml" = $cargoVersion
  "src-tauri/tauri.conf.json" = $tauriVersion
  "docs/ai/APP_SPEC.yaml" = $specVersion
}

$mismatch = $versions.GetEnumerator() | Where-Object { $_.Value -ne $Version }
if ($mismatch) {
  $details = ($mismatch | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", "
  throw "Las versiones no coinciden con $Version`: $details"
}

$status = @(git status --porcelain=v1)
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo leer el estado de Git."
}
if ($status.Count -gt 0) {
  throw "El árbol de trabajo debe estar limpio antes de publicar. Guardá primero los cambios en un commit."
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  throw "La publicación estable debe ejecutarse desde main; rama actual: $branch"
}

$tag = "app-v$Version"
git rev-parse --verify --quiet "refs/tags/$tag" | Out-Null
if ($LASTEXITCODE -eq 0) {
  throw "El tag local $tag ya existe."
}

$remoteTag = git ls-remote --tags origin "refs/tags/$tag"
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo comprobar el tag remoto."
}
if ($remoteTag) {
  throw "El tag remoto $tag ya existe."
}

$updaterDir = Join-Path $env:APPDATA "DTF Pro Studio/updater"
$privateKeyPath = Join-Path $updaterDir "tauri-updater.key"
$publicKeyPath = Join-Path $updaterDir "tauri-updater.key.pub"
$passwordPath = Join-Path $updaterDir "tauri-updater-password.txt"
foreach ($requiredPath in @($privateKeyPath, $publicKeyPath, $passwordPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Falta el archivo privado requerido: $requiredPath"
  }
}

$configuredPublicKey = (Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json).plugins.updater.pubkey.Trim()
$installedPublicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()
if ($configuredPublicKey -ne $installedPublicKey) {
  throw "La clave pública instalada no coincide con src-tauri/tauri.conf.json."
}

$modelMetadata = Get-Content "models/background-removal/model.json" -Raw | ConvertFrom-Json
$resourceChecks = [ordered]@{
  "models/background-removal/$($modelMetadata.file)" = $modelMetadata.sha256
}
foreach ($runtimeFile in $modelMetadata.runtime.files.PSObject.Properties) {
  $resourceChecks["models/background-removal/runtime/$($runtimeFile.Name)"] = [string]$runtimeFile.Value
}
foreach ($resource in $resourceChecks.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $resource.Key -PathType Leaf)) {
    throw "Falta $($resource.Key). Ejecutá scripts/install-birefnet-model.ps1."
  }
  $actualHash = (Get-FileHash -LiteralPath $resource.Key -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $resource.Value.ToLowerInvariant()) {
    throw "El hash de $($resource.Key) no coincide con model.json."
  }
}

Invoke-Checked "Typecheck" { node node_modules/typescript/bin/tsc -b --pretty false }
Invoke-Checked "Pruebas web" { node node_modules/vitest/vitest.mjs run }
Invoke-Checked "Build web" { node node_modules/vite/bin/vite.js build }
$env:CARGO_BUILD_JOBS = "2"
try {
  Invoke-Checked "Pruebas Rust" { cargo test --manifest-path src-tauri/Cargo.toml }
}
finally {
  Remove-Item Env:CARGO_BUILD_JOBS -ErrorAction SilentlyContinue
}

$signingPassword = (Get-Content -LiteralPath $passwordPath -Raw).TrimEnd("`r", "`n")
$env:TAURI_SIGNING_PRIVATE_KEY = $privateKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $signingPassword
$env:CARGO_BUILD_JOBS = "2"
try {
  Invoke-Checked "Instalador NSIS firmado" { node node_modules/@tauri-apps/cli/tauri.js build --ci --bundles nsis }
}
finally {
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:CARGO_BUILD_JOBS -ErrorAction SilentlyContinue
  $signingPassword = $null
}

$bundleDir = Join-Path $projectRoot "src-tauri/target/release/bundle/nsis"
$sourceInstaller = Join-Path $bundleDir "DTF Pro Studio_${Version}_x64-setup.exe"
$sourceSignature = "$sourceInstaller.sig"
foreach ($asset in @($sourceInstaller, $sourceSignature)) {
  if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
    throw "Tauri no generó el asset esperado: $asset"
  }
}

$assetDir = Join-Path $projectRoot "src-tauri/target/release/bundle/release-assets-$Version"
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
$assetName = "DTF.Pro.Studio_${Version}_x64-setup.exe"
$publishedInstaller = Join-Path $assetDir $assetName
$publishedSignature = "$publishedInstaller.sig"
Copy-Item -LiteralPath $sourceInstaller -Destination $publishedInstaller -Force
Copy-Item -LiteralPath $sourceSignature -Destination $publishedSignature -Force

$signature = (Get-Content -LiteralPath $publishedSignature -Raw).Trim()
$downloadUrl = "https://github.com/$Repository/releases/download/$tag/$assetName"
$notes = if ($ReleaseNotesFile) {
  (Get-Content -LiteralPath $ReleaseNotesFile -Raw).Trim()
} elseif ($ReleaseNotes) {
  $ReleaseNotes.Trim()
} else {
  "Versión estable $Version de DTF Pro Studio."
}

$latest = [ordered]@{
  version = $Version
  notes = $notes
  pub_date = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64-nsis" = [ordered]@{ signature = $signature; url = $downloadUrl }
    "windows-x86_64" = [ordered]@{ signature = $signature; url = $downloadUrl }
  }
}
$latestPath = Join-Path $assetDir "latest.json"
$latestJson = $latest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($latestPath, $latestJson, [System.Text.UTF8Encoding]::new($false))

Invoke-Checked "Push de main" { git push origin main }
Invoke-Checked "Crear tag $tag" { git tag -a $tag -m "DTF Pro Studio $Version estable" }
try {
  Invoke-Checked "Push de $tag" { git push origin $tag }
}
catch {
  git tag -d $tag | Out-Null
  throw
}

$temporaryToken = $null
$hadToken = [bool]$env:GH_TOKEN
if (-not $hadToken) {
  $temporaryToken = Get-GitHubTokenFromCredentialManager
  $env:GH_TOKEN = $temporaryToken
}
try {
  Invoke-Checked "Publicar GitHub Release" {
    gh release create $tag --repo $Repository $publishedInstaller $publishedSignature $latestPath `
      --title "DTF Pro Studio v$Version estable" --notes $notes --latest
  }

  $verificationPath = Join-Path $env:TEMP "dtf-pro-studio-latest-$Version.json"
  Invoke-WebRequest -Uri "https://github.com/$Repository/releases/latest/download/latest.json" `
    -Headers @{ "User-Agent" = "DTF-Pro-Studio-Release" } -OutFile $verificationPath -UseBasicParsing
  $verified = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
  Remove-Item -LiteralPath $verificationPath -Force -ErrorAction SilentlyContinue
  if ($verified.version -ne $Version) {
    throw "El endpoint latest informa $($verified.version), no $Version."
  }
  if (-not $verified.platforms."windows-x86_64-nsis".signature) {
    throw "El endpoint latest no contiene la firma NSIS."
  }
}
finally {
  if (-not $hadToken) {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
  }
  $temporaryToken = $null
}

Write-Host "`nRelease publicado y verificado:" -ForegroundColor Green
Write-Host "https://github.com/$Repository/releases/tag/$tag"
