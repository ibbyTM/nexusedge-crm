<#
.SYNOPSIS
  One-time local setup for the NexusEdge CRM on Windows. No installers, no admin.

.DESCRIPTION
  Downloads portable PHP, MariaDB and (if missing) Node into .local\, creates
  the database, writes server\config.php with generated secrets, installs npm
  packages, builds the front end, then starts everything and opens the browser.

  Re-running is safe: finished steps are skipped.

.PARAMETER Token
  Your agency-level HighLevel Private Integration token. Leave empty to run
  against the built-in mock API with sample data.
#>
param(
	[string]$Token = ""
)

. (Join-Path $PSScriptRoot "common.ps1")

New-Item -ItemType Directory -Force -Path $Local | Out-Null

function Download($url, $destination, $sizeHint = "") {
	if (Test-Path $destination) { Note "already downloaded: $(Split-Path $destination -Leaf)"; return }
	Note "downloading $url $sizeHint"
	# Download to a .part file first so an interrupted run never leaves a half zip behind.
	$partial = "$destination.part"
	if (Test-Path $partial) { Remove-Item $partial -Force }
	$client = New-Object System.Net.WebClient
	$client.Headers.Add("User-Agent", "nexusedge-crm-setup")
	$started = Get-Date
	try {
		$client.DownloadFile($url, $partial)
	} finally {
		$client.Dispose()
	}
	Move-Item $partial $destination
	$mb = [math]::Round((Get-Item $destination).Length / 1MB, 1)
	Note ("saved {0} MB in {1:n0}s" -f $mb, ((Get-Date) - $started).TotalSeconds)
}

function Extract-Single($zip, $target) {
	# Extracts a zip whose content is one top-level folder and moves that folder to $target.
	if (Test-Path $target) { return }
	$temp = "$target-tmp"
	if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
	Expand-Archive -Path $zip -DestinationPath $temp -Force
	$inner = Get-ChildItem $temp | Select-Object -First 1
	Move-Item $inner.FullName $target
	Remove-Item $temp -Recurse -Force
}

# ---------------------------------------------------------------- Node
Step "Node.js"
$NodeDir = Find-Node
if (-not $NodeDir) {
	$index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
	$lts = $index | Where-Object { $_.lts -and $_.version -like "v22.*" } | Select-Object -First 1
	$version = $lts.version
	Download "https://nodejs.org/dist/$version/node-$version-win-x64.zip" (Join-Path $Local "node.zip") "(about 30 MB)"
	Extract-Single (Join-Path $Local "node.zip") (Join-Path $Local "node")
	$NodeDir = Join-Path $Local "node"
}
$env:Path = "$NodeDir;$env:Path"
Note ("node " + (& node.exe --version))

# ---------------------------------------------------------------- PHP
Step "PHP"
if ((Test-Path $PhpDir) -and -not (Test-Path $PhpExe)) { Remove-Item $PhpDir -Recurse -Force }
if (-not (Test-Path $PhpExe)) {
	$releases = Invoke-RestMethod -Uri "https://downloads.php.net/~windows/releases/releases.json" -UseBasicParsing
	$branch = $releases."8.4"
	if (-not $branch) { $branch = $releases."8.3" }
	$key = $branch.PSObject.Properties.Name | Where-Object { $_ -like "nts-vs*-x64" } | Select-Object -First 1
	$zipName = $branch.$key.zip.path
	Download "https://downloads.php.net/~windows/releases/$zipName" (Join-Path $Local "php.zip") "(about 30 MB)"
	Expand-Archive -Path (Join-Path $Local "php.zip") -DestinationPath $PhpDir -Force
}
$caFile = Join-Path $PhpDir "cacert.pem"
Download "https://curl.se/ca/cacert.pem" $caFile
$ini = Join-Path $PhpDir "php.ini"
if (-not (Test-Path $ini)) {
	Copy-Item (Join-Path $PhpDir "php.ini-development") $ini
	@"

; ---- added by scripts/windows/setup.ps1 ----
extension_dir = "ext"
extension=curl
extension=openssl
extension=pdo_mysql
extension=mbstring
extension=sodium
curl.cainfo = "$caFile"
openssl.cafile = "$caFile"
date.timezone = UTC
"@ | Add-Content -Path $ini -Encoding ASCII
}
Note ((& $PhpExe -v) | Select-Object -First 1)
$modules = & $PhpExe -m
foreach ($required in @("curl", "openssl", "pdo_mysql", "mbstring")) {
	if ($modules -notcontains $required) { throw "PHP extension $required did not load. Check $ini" }
}

# ---------------------------------------------------------------- MariaDB
Step "MariaDB"
$mariaVersion = "11.4.7"
if (-not (Test-Path (Join-Path $MariaDir "bin\mariadbd.exe"))) {
	Download "https://archive.mariadb.org/mariadb-$mariaVersion/winx64-packages/mariadb-$mariaVersion-winx64.zip" (Join-Path $Local "mariadb.zip") "(about 90 MB, the big one)"
	Extract-Single (Join-Path $Local "mariadb.zip") $MariaDir
}
if (-not (Test-Path (Join-Path $MariaData "mysql"))) {
	Note "initialising data directory"
	& (Join-Path $MariaDir "bin\mariadb-install-db.exe") "--datadir=$MariaData" "--password=$MariaRootPassword" "--port=$MariaPort" | Out-Null
}
Start-Database
$mariaClient = Join-Path $MariaDir "bin\mariadb.exe"
& $mariaClient "-uroot" "-p$MariaRootPassword" "--port=$MariaPort" "-e" "CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
$schema = Join-Path $Root "server\schema.sql"
cmd /c "`"$mariaClient`" -uroot -p$MariaRootPassword --port=$MariaPort $DbName < `"$schema`""
Note "database $DbName ready"

# ---------------------------------------------------------------- config.php
Step "server\config.php"
function New-Secret { -join ((1..48) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) }) }
if (-not (Test-Path $ConfigPath)) {
	$useMock = [string]::IsNullOrWhiteSpace($Token)
	$ghlToken = if ($useMock) { "pit-local-mock-token" } else { $Token.Trim() }
	$apiBase = if ($useMock) { "http://127.0.0.1:8090" } else { "https://services.leadconnectorhq.com" }
	@"
<?php
// Generated by scripts/windows/setup.ps1 for local development. Gitignored.
const DB_HOST = '127.0.0.1';
const DB_PORT = $MariaPort;
const DB_NAME = '$DbName';
const DB_USER = 'root';
const DB_PASS = '$MariaRootPassword';
const SESSION_SECRET = '$(New-Secret)';
const BOOTSTRAP_ADMIN_EMAIL = '$AdminEmail';
const BOOTSTRAP_ADMIN_PASSWORD = '$AdminPassword';
const BOOTSTRAP_ADMIN_NAME = 'Local Admin';
const GHL_AGENCY_TOKEN = '$ghlToken';
const GHL_COMPANY_ID = '';
const GHL_LOCATION_TOKENS = [];
const GHL_WEBHOOK_KEY = '$(New-Secret)';
const GHL_ED25519_PUBLIC_KEY = '';
const CRON_KEY = '$(New-Secret)';
const APP_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
// Mock API for sample data, or https://services.leadconnectorhq.com for real data.
const GHL_API_BASE = '$apiBase';
"@ | Set-Content -Path $ConfigPath -Encoding UTF8
	if ($useMock) { Note "written for the MOCK API (sample data). Re-run with -Token pit-... or edit the file to use HighLevel." }
	else { Note "written with your HighLevel token" }
} else {
	Note "already exists, leaving it alone"
}

# ---------------------------------------------------------------- front end
Step "npm install"
& (Join-Path $NodeDir "npm.cmd") install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Step "npm run build"
& (Join-Path $NodeDir "npm.cmd") run build
if ($LASTEXITCODE -ne 0) { throw "next build failed" }

# ---------------------------------------------------------------- go
Step "Starting"
& (Join-Path $PSScriptRoot "start.ps1")
