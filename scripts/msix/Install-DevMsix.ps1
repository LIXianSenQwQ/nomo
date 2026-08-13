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

Write-Host '即将把 Nomo 开发证书加入当前用户 TrustedPeople，并安装开发 MSIX。'
Import-Certificate -FilePath $resolvedCertificate -CertStoreLocation 'Cert:\CurrentUser\TrustedPeople' | Out-Null
Add-AppxPackage -Path $resolvedPackage
Write-Host "已安装开发包：$resolvedPackage"
