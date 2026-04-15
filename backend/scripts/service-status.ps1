$serviceName = $env:FATBOY_SERVICE_NAME

if ([string]::IsNullOrWhiteSpace($serviceName)) {
  $serviceName = 'FatboyPOSBackend'
}

$candidateNames = @($serviceName)
if ($serviceName -ine 'FatboyPOSBackend') {
  $candidateNames += 'FatboyPOSBackend'
}

$service = $null
foreach ($candidate in $candidateNames) {
  $service = Get-Service -Name $candidate -ErrorAction SilentlyContinue
  if ($service) {
    break
  }
}

if (-not $service) {
  $testedNames = $candidateNames -join ', '
  throw "Servicio no encontrado. Nombres probados: $testedNames. Si aun no lo instalas, ejecuta: npm --prefix backend run service:install"
}

$service | Format-List Name, Status, StartType, DisplayName
