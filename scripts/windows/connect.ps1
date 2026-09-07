<#
.SYNOPSIS
  Points the local CRM at your real HighLevel account.

.DESCRIPTION
  Writes the token into server\config.php, switches GHL_API_BASE to the real
  API, clears the sample data (the mock sub-accounts and contacts must not mix
  with real ones), and restarts the servers. Sign in again with the bootstrap
  admin details afterwards and run Sync everything now.

.PARAMETER Token
  Agency-level Private Integration token from HighLevel (starts with pit-).
#>
param(
	[Parameter(Mandatory = $true)]
	[string]$Token
)

. (Join-Path $PSScriptRoot "common.ps1")

$Token = $Token.Trim()
if ($Token -notlike "pit-*") { throw "That does not look like a Private Integration token (they start with pit-)." }
if (-not (Test-Path $ConfigPath)) { throw "server\config.php is missing. Run setup.bat first." }

Step "Stopping servers"
& (Join-Path $PSScriptRoot "stop.ps1")

Step "Updating server\config.php"
$config = Get-Content $ConfigPath -Raw
$config = [regex]::Replace($config, "const GHL_AGENCY_TOKEN = '[^']*';", "const GHL_AGENCY_TOKEN = '$Token';")
$config = [regex]::Replace($config, "const GHL_API_BASE = '[^']*';", "const GHL_API_BASE = 'https://services.leadconnectorhq.com';")
Set-Content -Path $ConfigPath -Value $config -Encoding UTF8
Note "token saved, API base set to services.leadconnectorhq.com"

Step "Clearing sample data"
Start-Database
$mariaClient = Join-Path $MariaDir "bin\mariadb.exe"
& $mariaClient "-uroot" "-p$MariaRootPassword" "--port=$MariaPort" "-e" "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
$schema = Join-Path $Root "server\schema.sql"
cmd /c "`"$mariaClient`" -uroot -p$MariaRootPassword --port=$MariaPort $DbName < `"$schema`""
Note "fresh database"

Step "Checking the token against HighLevel"
$probe = & $PhpExe -r "define('NE_PROBE', 1); require 'server/lib/http.php'; require 'server/lib/ids.php'; require 'server/config.php'; require 'server/lib/db.php'; require 'server/lib/ghl.php'; try { `$r = ghl_search_locations(0, 5); echo 'OK ' . count(`$r['locations'] ?? []) . ' sub-account(s) visible'; } catch (Exception `$e) { echo 'FAIL ' . `$e->getMessage(); }"
if ($probe -like "OK*") { Note $probe } else { Write-Host "    $probe" -ForegroundColor Yellow; Write-Host "    The token was saved anyway. Check its scopes include locations.readonly and that it was created at the agency level." -ForegroundColor Yellow }

Step "Starting"
& (Join-Path $PSScriptRoot "start.ps1")
