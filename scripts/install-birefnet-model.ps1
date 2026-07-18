[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$modelRevision = "de15b22ba131738a16dff04aab8bdf8dc32e3ac1"
$modelUrl = "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/$modelRevision/onnx/model.onnx?download=true"
$modelSha256 = "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333"
$onnxRuntimeUrl = "https://www.nuget.org/api/v2/package/Microsoft.ML.OnnxRuntime.DirectML/1.24.4"
$directMlUrl = "https://www.nuget.org/api/v2/package/Microsoft.AI.DirectML/1.15.4"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modelDirectory = Join-Path $repositoryRoot "models\background-removal"
$runtimeDirectory = Join-Path $modelDirectory "runtime"
$modelPath = Join-Path $modelDirectory "birefnet-lite.onnx"
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("dtf-birefnet-" + [Guid]::NewGuid().ToString("N"))

function Assert-Sha256 {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Expected
    )

    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected) {
        throw "SHA-256 inválido para $Path. Esperado: $Expected. Obtenido: $actual."
    }
}

function Expand-NugetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $archive = Join-Path $temporaryDirectory "$Name.zip"
    $destination = Join-Path $temporaryDirectory $Name
    Invoke-WebRequest -Uri $Url -OutFile $archive -UseBasicParsing
    Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
    return $destination
}

New-Item -ItemType Directory -Force -Path $modelDirectory, $runtimeDirectory, $temporaryDirectory | Out-Null

try {
    if ((Test-Path -LiteralPath $modelPath) -and
        ((Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant() -eq $modelSha256)) {
        Write-Host "BiRefNet Lite ya está instalado y verificado."
    }
    else {
        $partialModelPath = Join-Path $temporaryDirectory "birefnet-lite.onnx"
        Write-Host "Descargando BiRefNet Lite (aprox. 224 MB)..."
        Invoke-WebRequest -Uri $modelUrl -OutFile $partialModelPath -UseBasicParsing
        Assert-Sha256 -Path $partialModelPath -Expected $modelSha256
        Copy-Item -LiteralPath $partialModelPath -Destination $modelPath -Force
    }

    Write-Host "Instalando ONNX Runtime y DirectML oficiales..."
    $onnxRuntimePackage = Expand-NugetPackage -Url $onnxRuntimeUrl -Name "onnxruntime"
    $directMlPackage = Expand-NugetPackage -Url $directMlUrl -Name "directml"

    $runtimeFiles = @(
        @{
            Source = Join-Path $onnxRuntimePackage "runtimes\win-x64\native\onnxruntime.dll"
            Destination = Join-Path $runtimeDirectory "onnxruntime.dll"
            Sha256 = "e7eedec6a6f26dc39dc948276a75ef6d2bee3fff944d874ceed0bbd3b97bff40"
        },
        @{
            Source = Join-Path $onnxRuntimePackage "runtimes\win-x64\native\onnxruntime_providers_shared.dll"
            Destination = Join-Path $runtimeDirectory "onnxruntime_providers_shared.dll"
            Sha256 = "265c8daf29637cb259cac8be9f08f2cd45f3883f0f0e4949cbfddd5b4cbec3b6"
        },
        @{
            Source = Join-Path $directMlPackage "bin\x64-win\DirectML.dll"
            Destination = Join-Path $runtimeDirectory "DirectML.dll"
            Sha256 = "9c9e6d822561c6c41b90e6994b3e8857cf1d66dbfb1e0c4c799c7c89b4e92da1"
        }
    )

    foreach ($runtimeFile in $runtimeFiles) {
        Copy-Item -LiteralPath $runtimeFile.Source -Destination $runtimeFile.Destination -Force
        Assert-Sha256 -Path $runtimeFile.Destination -Expected $runtimeFile.Sha256
    }

    Assert-Sha256 -Path $modelPath -Expected $modelSha256
    Write-Host "BiRefNet Lite, ONNX Runtime y DirectML quedaron instalados y verificados."
}
finally {
    $resolvedTemporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $resolvedTemporaryDirectory = [IO.Path]::GetFullPath($temporaryDirectory)
    if ($resolvedTemporaryDirectory.StartsWith($resolvedTemporaryRoot, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $resolvedTemporaryDirectory)) {
        Remove-Item -LiteralPath $resolvedTemporaryDirectory -Recurse -Force
    }
}
