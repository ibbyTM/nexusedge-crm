# Shared paths and helpers for the Windows scripts. Dot-sourced, not run directly.
$ErrorActionPreference = "Stop"
# Windows PowerShell renders a progress bar for every downloaded chunk, which makes
# Invoke-WebRequest painfully slow on big files. Silence it.
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Local = Join-Path $Root ".local"
$PhpDir = Join-Path $Local "php"
$PhpExe = Join-Path $PhpDir "php.exe"
$MariaDir = Join-Path $Local "mariadb"
$MariaData = Join-Path $Local "mariadb-data"
$MariaPort = 3307
$MariaRootPassword = "crm-local"
$DbName = "nexusedge_crm"
$ConfigPath = Join-Path $Root "server\config.php"
$AdminEmail = "admin@nexusedge.test"
$AdminPassword = "nexusedge-local"

function Step($message) {
	Write-Host ""
	Write-Host "==> $message" -ForegroundColor Magenta
}

function Note($message) {
	Write-Host "    $message" -ForegroundColor DarkGray
}

function Test-Port($port) {
	$client = New-Object System.Net.Sockets.TcpClient
	try {
		$async = $client.BeginConnect("127.0.0.1", $port, $null, $null)
		if (-not $async.AsyncWaitHandle.WaitOne(400)) { return $false }
		$client.EndConnect($async)
		return $true
	} catch {
		return $false
	} finally {
		$client.Close()
	}
}

function Wait-Port($port, $label, $seconds = 60) {
	$deadline = (Get-Date).AddSeconds($seconds)
	while ((Get-Date) -lt $deadline) {
		if (Test-Port $port) { return }
		Start-Sleep -Milliseconds 500
	}
	throw "$label did not start listening on port $port within $seconds seconds."
}

function Find-Node {
	$cmd = Get-Command node.exe -ErrorAction SilentlyContinue
	if ($cmd) { return (Split-Path $cmd.Source) }
	$portable = Join-Path $Local "node"
	if (Test-Path (Join-Path $portable "node.exe")) { return $portable }
	return $null
}

function Config-UsesMock {
	if (-not (Test-Path $ConfigPath)) { return $false }
	return (Select-String -Path $ConfigPath -Pattern "127\.0\.0\.1:8090" -Quiet)
}

function Start-Database {
	if (Test-Port $MariaPort) { Note "MariaDB already running on port $MariaPort"; return }
	$exe = Join-Path $MariaDir "bin\mariadbd.exe"
	if (-not (Test-Path $exe)) { throw "MariaDB is not installed yet. Run setup.bat first." }
	Start-Process -FilePath $exe -ArgumentList @("--datadir=`"$MariaData`"", "--port=$MariaPort", "--bind-address=127.0.0.1", "--console") -WindowStyle Minimized
	Wait-Port $MariaPort "MariaDB"
	Note "MariaDB listening on 127.0.0.1:$MariaPort"
}

function Start-PhpServer($port, $script, $title) {
	if (Test-Port $port) { Note "$title already running on port $port"; return }
	$arguments = @("-S", "127.0.0.1:$port", "`"$script`"")
	Start-Process -FilePath $PhpExe -ArgumentList $arguments -WorkingDirectory $Root -WindowStyle Minimized
	Wait-Port $port $title 30
	Note "$title listening on 127.0.0.1:$port"
}
