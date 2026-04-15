$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'out\Fatboy POS-win32-x64'

Get-Process | ForEach-Object {
  $path = $null

  try {
    $path = $_.Path
  } catch {
    $path = $null
  }

  [PSCustomObject]@{
    Id = $_.Id
    Name = $_.ProcessName
    Path = $path
    IsTarget = if ($path) { $path -like "*$target*" } else { $false }
  }
} | Where-Object {
  $_.Name -match 'electron|FatboyPOS|node' -or $_.IsTarget
} | Sort-Object Name, Id | Format-Table -AutoSize
