# Arma la carpeta portable para el betatester: copia el lanzador + dist\ y crea
# un .zip listo para enviar. Ejecuta antes "npm run build" (o usa "npm run portable").
$ErrorActionPreference = 'Stop'
$projRoot = $PSScriptRoot
$dist = Join-Path $projRoot 'dist'
$portable = Join-Path $projRoot 'portable'
$out = Join-Path $projRoot 'Loreweaver-portable'
$zip = Join-Path $projRoot 'Loreweaver-portable.zip'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  throw "No existe dist\index.html. Ejecuta antes: npm run build"
}

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

# Lanzador (.bat, .ps1, LEEME) + la app compilada
Copy-Item (Join-Path $portable '*') $out -Recurse -Force
Copy-Item $dist (Join-Path $out 'dist') -Recurse -Force

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -Force

Write-Host ""
Write-Host "  Carpeta portable lista:  $out" -ForegroundColor Green
Write-Host "  Zip para enviar:         $zip" -ForegroundColor Green
Write-Host ""
