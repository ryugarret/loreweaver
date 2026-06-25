# Loreweaver — servidor local portable (sin instalar nada).
# Sirve la carpeta dist\ en http://localhost:8787 usando solo PowerShell + .NET,
# que ya vienen con Windows. Puerto FIJO para que el navegador conserve siempre
# los mismos datos (IndexedDB es por origen). Cierra esta ventana para apagar:
# el puerto se LIBERA siempre (handler de cierre + try/finally), así puedes
# volver a abrir la app al instante sin reiniciar el PC.
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$port = 8787
$prefix = "http://localhost:$port/"
$root = Join-Path $PSScriptRoot 'dist'
$rootFull = [System.IO.Path]::GetFullPath($root)

if (-not (Test-Path (Join-Path $root 'index.html'))) {
  Write-Host ""
  Write-Host "  No encuentro la carpeta 'dist' junto a este lanzador." -ForegroundColor Red
  Write-Host "  Asegurate de tener la carpeta completa tal cual te la pasaron."
  Write-Host ""
  Read-Host "  Pulsa Enter para cerrar"
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.txt'  = 'text/plain; charset=utf-8'
  '.map'  = 'application/json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  # El puerto esta ocupado: lo normal es que Loreweaver ya este abierto.
  Write-Host ""
  Write-Host "  Loreweaver ya parece estar abierto. Abriendo el navegador..." -ForegroundColor Yellow
  Start-Process $prefix
  Start-Sleep -Seconds 2
  exit 0
}

# Liberar el puerto SIEMPRE que se cierre la ventana (X), Ctrl+C, logoff o apagado.
# Sin esto, el puerto podria quedar pillado y no se podria reabrir la app.
$global:lwListener = $listener
try {
  if (-not ([System.Management.Automation.PSTypeName]'LWCtrl').Type) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LWCtrl {
  public delegate bool HandlerRoutine(uint ctrlType);
  [DllImport("kernel32.dll")]
  public static extern bool SetConsoleCtrlHandler(HandlerRoutine Handler, bool Add);
}
'@
  }
  $global:lwExitHandler = [LWCtrl+HandlerRoutine] {
    param($ctrlType)
    try {
      if ($global:lwListener) {
        $global:lwListener.Stop()
        $global:lwListener.Close()
        $global:lwListener = $null
      }
    } catch {}
    return $false  # deja que Windows termine el proceso normalmente
  }
  [LWCtrl]::SetConsoleCtrlHandler($global:lwExitHandler, $true) | Out-Null
} catch {
  # Si por lo que sea no se puede registrar el handler, el try/finally de abajo
  # y la liberacion del socket al morir el proceso siguen cubriendo el cierre.
}

Write-Host ""
Write-Host "  Loreweaver esta corriendo en:  $prefix" -ForegroundColor Green
Write-Host ""
Write-Host "  - Abriendo tu navegador..."
Write-Host "  - DEJA ESTA VENTANA ABIERTA mientras escribes."
Write-Host "  - Cierra esta ventana (o pulsa Ctrl+C) para apagar la app."
Write-Host "  - Para guardar en disco real, usa Chrome o Edge."
Write-Host ""
if (-not $NoBrowser) { Start-Process $prefix }

try {
  while ($listener.IsListening) {
    try {
      $ctx = $listener.GetContext()
    } catch {
      break  # el listener se detuvo (cierre) -> salir del bucle
    }
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ([string]::IsNullOrEmpty($rel) -or $rel -eq '/') { $rel = '/index.html' }
      $file = Join-Path $root ($rel.TrimStart('/') -replace '/', '\')
      $full = [System.IO.Path]::GetFullPath($file)

      if (-not $full.StartsWith($rootFull)) {
        $res.StatusCode = 403
      } else {
        if (-not (Test-Path $full -PathType Leaf)) {
          $full = Join-Path $root 'index.html'  # fallback SPA
        }
        if (Test-Path $full -PathType Leaf) {
          $bytes = [System.IO.File]::ReadAllBytes($full)
          $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
          $ct = $mime[$ext]
          if (-not $ct) { $ct = 'application/octet-stream' }
          $res.ContentType = $ct
          $res.Headers.Add('Cache-Control', 'no-cache')
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          $res.StatusCode = 404
        }
      }
    } catch {
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  # Liberacion garantizada del puerto en cualquier salida.
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
  $global:lwListener = $null
}
