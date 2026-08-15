[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$PackagePath,
    [Parameter(Mandatory)]
    [string]$CertificatePath
)

$ErrorActionPreference = 'Stop'
$resolvedPackage = (Resolve-Path -LiteralPath $PackagePath).Path
$resolvedCertificate = (Resolve-Path -LiteralPath $CertificatePath).Path

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentPrincipal = [Security.Principal.WindowsPrincipal]::new($currentIdentity)
$isAdministrator = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    Write-Host 'MSIX 开发证书需要加入本地计算机 TrustedPeople，正在请求管理员权限。'
    $escape = { param([string]$Value) $Value.Replace("'", "''") }
    $elevatedCommand = "& '$(& $escape $PSCommandPath)' -PackagePath '$(& $escape $resolvedPackage)' -CertificatePath '$(& $escape $resolvedCertificate)'"
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($elevatedCommand))
    $elevatedProcess = Start-Process -FilePath 'pwsh' -Verb RunAs -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', $encodedCommand
    ) -Wait -PassThru
    if ($elevatedProcess.ExitCode -ne 0) {
        throw "管理员安装进程失败，退出码：$($elevatedProcess.ExitCode)"
    }
    return
}

Write-Host '即将把 Nomo 自签名开发证书加入本地计算机 TrustedPeople，并安装开发 MSIX。'
Import-Certificate -FilePath $resolvedCertificate -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
Add-AppxPackage -Path $resolvedPackage
Write-Host "已安装开发包：$resolvedPackage"
