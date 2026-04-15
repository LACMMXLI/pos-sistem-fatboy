$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent

Push-Location $projectRoot
try {
  & npm --prefix backend run service:install
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
