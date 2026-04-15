[CmdletBinding()]
param(
  [string]$AppRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

. (Join-Path $PSScriptRoot 'fatboy-installer.config.ps1')
$Config = $script:FatboyInstallerConfig
$BackendRoot = Join-Path $AppRoot 'backend'
$LogPath = Join-Path $AppRoot 'logs\uninstall.log'

function Write-UninstallLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  $dir = Split-Path $LogPath -Parent
  if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  Write-UninstallLog 'Inicio desinstalacion segura Fatboy POS Backend.'
  $node = Join-Path $AppRoot 'node\node.exe'
  $serviceScript = Join-Path $BackendRoot 'scripts\windows-service.cjs'

  if ((Test-Path -LiteralPath $node) -and (Test-Path -LiteralPath $serviceScript)) {
    Push-Location $BackendRoot
    try {
      & $node $serviceScript 'uninstall'
      if ($LASTEXITCODE -ne 0) {
        Write-UninstallLog "Advertencia: windows-service.cjs uninstall devolvio $LASTEXITCODE."
      }
    } finally {
      Pop-Location
    }
  } else {
    $service = Get-Service -Name $Config.BackendServiceName -ErrorAction SilentlyContinue
    if ($service) {
      Stop-Service -Name $Config.BackendServiceName -Force -ErrorAction SilentlyContinue
      sc.exe delete $Config.BackendServiceName | Out-Null
    }
  }

  Write-UninstallLog 'No se elimina PostgreSQL ni la base de datos por politica conservadora.'
  Write-UninstallLog 'Desinstalacion segura completada.'
  exit 0
} catch {
  Write-UninstallLog "ERROR: $($_.Exception.Message)"
  exit 1
}
