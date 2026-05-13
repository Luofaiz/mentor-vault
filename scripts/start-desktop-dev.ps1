$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$viteBin = Join-Path $root 'node_modules\.bin\vite.cmd'
$electronBin = Join-Path $root 'node_modules\.bin\electron.cmd'
$viteOut = Join-Path $root '.vite-dev.stdout.log'
$viteErr = Join-Path $root '.vite-dev.stderr.log'
$electronOut = Join-Path $root '.electron-dev.stdout.log'
$electronErr = Join-Path $root '.electron-dev.stderr.log'
$devUrl = 'http://127.0.0.1:3000'

if (!(Test-Path $viteBin)) {
  throw "Vite executable not found: $viteBin"
}

if (!(Test-Path $electronBin)) {
  throw "Electron executable not found: $electronBin"
}

foreach ($logFile in @($viteOut, $viteErr, $electronOut, $electronErr)) {
  if (Test-Path $logFile) {
    Remove-Item $logFile -Force
  }
}

Write-Host "Starting Vite dev server at $devUrl ..."
$viteProcess = Start-Process -FilePath $viteBin `
  -ArgumentList '--host', '127.0.0.1', '--port', '3000' `
  -WorkingDirectory $root `
  -RedirectStandardOutput $viteOut `
  -RedirectStandardError $viteErr `
  -PassThru

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500

    if ($viteProcess.HasExited) {
      throw "Vite exited early. Check $viteErr"
    }

    try {
      Invoke-WebRequest -Uri $devUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
    }
  }

  if (-not $ready) {
    throw "Vite dev server did not become ready at $devUrl. Check $viteErr"
  }

  Write-Host 'Vite is ready. Launching Electron...'
  $originalDevUrl = $env:VITE_DEV_SERVER_URL
  $originalRunAsNode = $env:ELECTRON_RUN_AS_NODE
  $env:VITE_DEV_SERVER_URL = $devUrl
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

  try {
    $electronProcess = Start-Process -FilePath $electronBin `
      -ArgumentList '.' `
      -WorkingDirectory $root `
      -RedirectStandardOutput $electronOut `
      -RedirectStandardError $electronErr `
      -PassThru

    Wait-Process -Id $electronProcess.Id
  } finally {
    $env:VITE_DEV_SERVER_URL = $originalDevUrl
    $env:ELECTRON_RUN_AS_NODE = $originalRunAsNode
  }
} finally {
  if ($viteProcess -and -not $viteProcess.HasExited) {
    Stop-Process -Id $viteProcess.Id -Force
  }
}

Write-Host 'Electron exited. Vite dev server has been stopped.'
Write-Host "Logs:"
Write-Host "  Vite stdout: $viteOut"
Write-Host "  Vite stderr: $viteErr"
Write-Host "  Electron stdout: $electronOut"
Write-Host "  Electron stderr: $electronErr"
