<#
.SYNOPSIS
  Starts the local CRM: MariaDB, the PHP API with the built front end, and the
  mock HighLevel API when config.php points at it. Opens the browser.
#>
. (Join-Path $PSScriptRoot "common.ps1")

if (-not (Test-Path $PhpExe)) { throw "Nothing installed yet. Run setup.bat first." }
if (-not (Test-Path (Join-Path $Root "out\index.html"))) { throw "The front end is not built. Run setup.bat (or npm run build) first." }

Start-Database
if (Config-UsesMock) {
	Start-PhpServer 8090 (Join-Path $Root "server\mock-ghl\index.php") "Mock HighLevel API"
}
Start-PhpServer 8080 (Join-Path $Root "server\dev-router.php") "NexusEdge CRM"

Write-Host ""
Write-Host "  NexusEdge CRM is running at http://127.0.0.1:8080" -ForegroundColor Green
Write-Host "  Sign in with  $AdminEmail  /  $AdminPassword" -ForegroundColor Green
Write-Host "  First time: Settings > Sync and webhooks > Sync everything now" -ForegroundColor Green
Write-Host ""
Write-Host "  Three minimised windows keep the servers alive. Close them (or run stop.bat) to stop." -ForegroundColor DarkGray
Write-Host ""
Start-Process "http://127.0.0.1:8080"
