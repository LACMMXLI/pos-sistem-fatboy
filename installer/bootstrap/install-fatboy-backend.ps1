[CmdletBinding()]
param(
  [string]$AppRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

. (Join-Path $PSScriptRoot 'fatboy-installer.config.ps1')
$Config = $script:FatboyInstallerConfig
$BackendRoot = Join-Path $AppRoot 'backend'
$LogPath = Join-Path $AppRoot $Config.InstallLogRelativePath

function Write-InstallLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  $dir = Split-Path $LogPath -Parent
  if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Assert-Admin {
  $principal = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'El instalador debe ejecutarse como Administrador.'
  }
}

function Assert-WindowsX64 {
  if ($env:OS -ne 'Windows_NT') {
    throw 'Este instalador solo soporta Windows.'
  }
  if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'Este instalador requiere Windows x64.'
  }
}

function Invoke-EmbeddedNode {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $node = Join-Path $AppRoot 'node\node.exe'
  if (-not (Test-Path -LiteralPath $node)) { throw "No existe Node embebido: $node" }
  Push-Location $BackendRoot
  try {
    & $node @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Node fallo con codigo ${LASTEXITCODE}: $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Wait-HttpOk {
  param([string]$Url, [int]$TimeoutSeconds = 45)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4
      if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  return $false
}

function Assert-CriticalPayload {
  $required = @(
    (Join-Path $AppRoot 'node\node.exe'),
    (Join-Path $AppRoot 'nssm-2.24\win64\nssm.exe'),
    (Join-Path $BackendRoot 'dist\src\main.js'),
    (Join-Path $BackendRoot 'scripts\windows-service.cjs'),
    (Join-Path $BackendRoot 'scripts\service-launcher.cjs'),
    (Join-Path $BackendRoot 'node_modules\prisma\build\index.js'),
    (Join-Path $BackendRoot 'prisma\schema.prisma')
  )

  foreach ($item in $required) {
    if (-not (Test-Path -LiteralPath $item)) {
      throw "Payload incompleto. Falta: $item"
    }
  }
}

function Install-FatboyService {
  $serviceScript = Join-Path $BackendRoot 'scripts\windows-service.cjs'
  Write-InstallLog "Instalando/reinstalando servicio $($Config.BackendServiceName)"
  Invoke-EmbeddedNode -Arguments @($serviceScript, 'install')
}

function Assert-ServiceRunning {
  $service = Get-Service -Name $Config.BackendServiceName -ErrorAction Stop
  if ($service.Status -ne 'Running') {
    throw "El servicio $($Config.BackendServiceName) no esta Running. Estado: $($service.Status)"
  }
  Write-InstallLog "Servicio validado en Running: $($Config.BackendServiceName)"
}

try {
  Write-InstallLog "Inicio bootstrap Fatboy POS Backend. AppRoot=$AppRoot"
  Assert-Admin
  Assert-WindowsX64
  Assert-CriticalPayload

  Write-InstallLog 'Configurando PostgreSQL, base de datos, .env, migraciones y seed'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'configure-postgresql.ps1') -AppRoot $AppRoot -BackendRoot $BackendRoot -LogPath (Join-Path $AppRoot $Config.DatabaseLogRelativePath)
  if ($LASTEXITCODE -ne 0) { throw "configure-postgresql.ps1 fallo con codigo $LASTEXITCODE" }

  Install-FatboyService
  Assert-ServiceRunning

  $healthUrl = 'http://{0}:{1}/api' -f $Config.BackendHost, $Config.BackendPort
  if (-not (Wait-HttpOk -Url $healthUrl -TimeoutSeconds 60)) {
    throw "El backend no respondio en $healthUrl"
  }

  Write-InstallLog "Instalacion completada correctamente. Backend=$healthUrl"
  exit 0
} catch {
  Write-InstallLog "ERROR: $($_.Exception.Message)"
  exit 1
}
