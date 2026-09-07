<# Stops the PHP servers and MariaDB started from .local\ #>
. (Join-Path $PSScriptRoot "common.ps1")
$stopped = 0
foreach ($proc in Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Local, [System.StringComparison]::OrdinalIgnoreCase) }) {
	Note "stopping $($proc.ProcessName) ($($proc.Id))"
	Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
	$stopped++
}
Write-Host "Stopped $stopped process(es)."
