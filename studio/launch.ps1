param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioDir = $PSScriptRoot
$projectDir = Split-Path $studioDir -Parent
$studioUrl = 'http://127.0.0.1:4318'
function Test-Studio {
  try { return (Invoke-RestMethod "$studioUrl/api/info" -TimeoutSec 2).app -eq 'paper-trails-studio' } catch { return $false }
}
if (-not (Test-Studio)) {
  $nodePath = (Get-Command node.exe).Source
  $logDir = Join-Path $projectDir '.studio'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Start-Process -FilePath $nodePath -ArgumentList 'server.mjs' -WorkingDirectory $studioDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
  for ($attempt = 0; $attempt -lt 20; $attempt++) { if (Test-Studio) { break }; Start-Sleep -Milliseconds 300 }
  if (-not (Test-Studio)) { throw "写作台启动失败，请查看 $logDir\server-error.log" }
}
if (-not $NoBrowser) { Start-Process $studioUrl }
