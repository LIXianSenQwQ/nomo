[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release',
    [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$projectRoot = Join-Path $repoRoot 'src-tauri\windows-shell-extension'

function Resolve-MSBuildEnvironment {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vswhere)) {
        throw '找不到 Visual Studio Installer 的 vswhere.exe。'
    }

    $installationPath = (& $vswhere -latest -products * -requires Microsoft.Component.MSBuild -property installationPath | Select-Object -First 1)
    if (-not $installationPath) {
        throw '未找到包含 MSBuild 的 Visual Studio。'
    }

    $msbuild = Join-Path $installationPath 'MSBuild\Current\Bin\MSBuild.exe'
    if (-not (Test-Path -LiteralPath $msbuild)) {
        throw "找不到 MSBuild：$msbuild"
    }
    $toolsetCandidates = Get-ChildItem -Path (Join-Path $installationPath 'MSBuild\Microsoft\VC\v*\Platforms\x64\PlatformToolsets\*') -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^v\d+$' } |
        Sort-Object { [int]$_.Name.Substring(1) } -Descending
    $platformToolset = $toolsetCandidates | Select-Object -First 1 -ExpandProperty Name
    if (-not $platformToolset) {
        throw '未找到可用的 Visual C++ x64 平台工具集。'
    }

    return [pscustomobject]@{
        MSBuild = $msbuild
        PlatformToolset = $platformToolset
    }
}

$buildEnvironment = Resolve-MSBuildEnvironment
$msbuild = $buildEnvironment.MSBuild
$platformToolset = $buildEnvironment.PlatformToolset
$dllProject = Join-Path $projectRoot 'NomoShellExtension.vcxproj'
$testProject = Join-Path $projectRoot 'NomoShellExtensionTests.vcxproj'

& $msbuild $dllProject /nologo /m /t:Build "/p:Configuration=$Configuration" '/p:Platform=x64' "/p:PlatformToolset=$platformToolset"
if ($LASTEXITCODE -ne 0) {
    throw "NomoShellExtension 构建失败，退出码：$LASTEXITCODE"
}

if ($RunTests) {
    & $msbuild $testProject /nologo /m /t:Build "/p:Configuration=$Configuration" '/p:Platform=x64' "/p:PlatformToolset=$platformToolset"
    if ($LASTEXITCODE -ne 0) {
        throw "NomoShellExtensionTests 构建失败，退出码：$LASTEXITCODE"
    }

    $testExe = Join-Path $projectRoot "bin\x64\$Configuration\NomoShellExtensionTests.exe"
    & $testExe
    if ($LASTEXITCODE -ne 0) {
        throw "NomoShellExtensionTests 执行失败，退出码：$LASTEXITCODE"
    }
}

$dllPath = Join-Path $projectRoot "bin\x64\$Configuration\NomoShellExtension.dll"
if (-not (Test-Path -LiteralPath $dllPath)) {
    throw "Shell 扩展构建完成但未找到 DLL：$dllPath"
}

Write-Output $dllPath
