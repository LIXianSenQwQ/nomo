[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$identityPath = Join-Path $repoRoot 'src-tauri\msix\package-identity.json'
$identity = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot '.artifacts\msix\dev-certificate'
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$pfxPath = Join-Path $OutputDirectory 'NomoDevelopment.pfx'
$cerPath = Join-Path $OutputDirectory 'NomoDevelopment.cer'
$passwordPath = Join-Path $OutputDirectory 'NomoDevelopment.password.txt'

if (-not $Force -and (Test-Path $pfxPath) -and (Test-Path $cerPath) -and (Test-Path $passwordPath)) {
    [pscustomobject]@{
        PfxPath = $pfxPath
        CerPath = $cerPath
        PasswordPath = $passwordPath
        Publisher = [string]$identity.publisher
    } | ConvertTo-Json
    return
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$passwordBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$password = [Convert]::ToBase64String($passwordBytes)
$rsa = [Security.Cryptography.RSA]::Create(3072)
try {
    $distinguishedName = [Security.Cryptography.X509Certificates.X500DistinguishedName]::new(
        [string]$identity.publisher
    )
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
        $distinguishedName,
        $rsa,
        [Security.Cryptography.HashAlgorithmName]::SHA256,
        [Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $request.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
    )
    $request.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
            [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
            $true
        )
    )
    $eku = [Security.Cryptography.OidCollection]::new()
    [void]$eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3', 'Code Signing'))
    $request.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $true)
    )
    $request.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new(
            $request.PublicKey,
            $false
        )
    )

    $certificate = $request.CreateSelfSigned(
        [DateTimeOffset]::UtcNow.AddMinutes(-5),
        [DateTimeOffset]::UtcNow.AddYears(2)
    )
    try {
        [IO.File]::WriteAllBytes(
            $pfxPath,
            $certificate.Export(
                [Security.Cryptography.X509Certificates.X509ContentType]::Pfx,
                $password
            )
        )
        [IO.File]::WriteAllBytes(
            $cerPath,
            $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        )
        [IO.File]::WriteAllText($passwordPath, $password, [Text.UTF8Encoding]::new($false))
    }
    finally {
        $certificate.Dispose()
    }
}
finally {
    $rsa.Dispose()
}

[pscustomobject]@{
    PfxPath = $pfxPath
    CerPath = $cerPath
    PasswordPath = $passwordPath
    Publisher = [string]$identity.publisher
} | ConvertTo-Json
