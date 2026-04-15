$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root 'out'

$processes = Get-Process | Where-Object {
  $_.ProcessName -match 'electron|FatboyPOS'
}

foreach ($process in $processes) {
  try {
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
  } catch {
    Write-Warning "No se pudo cerrar el proceso $($process.ProcessName) ($($process.Id)): $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 2

if (Test-Path -LiteralPath $outPath) {
  Remove-Item -LiteralPath $outPath -Recurse -Force
}

Write-Output 'CLEAN_OK'
