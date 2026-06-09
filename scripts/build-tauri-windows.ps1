param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TauriArgs
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$defaultKeyPath = Join-Path $projectRoot '.env.nomo-updater.key'
$pnpmPath = 'C:\Users\89225\AppData\Roaming\npm\pnpm.cmd'

if ($TauriArgs.Count -gt 0 -and $TauriArgs[0] -eq '--') {
  $TauriArgs = if ($TauriArgs.Count -eq 1) { @() } else { $TauriArgs[1..($TauriArgs.Count - 1)] }
}

if ($TauriArgs.Count -eq 0) {
  $TauriArgs = @('build', '--bundles', 'nsis')
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  $privateKeyPath = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH
  } else {
    $defaultKeyPath
  }

  if (-not (Test-Path -LiteralPath $privateKeyPath -PathType Leaf)) {
    throw "未找到本地 Tauri updater 私钥文件：$privateKeyPath。请设置 TAURI_SIGNING_PRIVATE_KEY，或把私钥保存到该路径。"
  }

  $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -LiteralPath $privateKeyPath -Raw).Trim()
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
  Write-Host '未检测到 TAURI_SIGNING_PRIVATE_KEY_PASSWORD，按空密码私钥处理。'
}

if (Test-Path -LiteralPath $pnpmPath -PathType Leaf) {
  & $pnpmPath exec tauri @TauriArgs
} else {
  & pnpm exec tauri @TauriArgs
}

exit $LASTEXITCODE
