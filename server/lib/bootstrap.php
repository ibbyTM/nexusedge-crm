<?php
/**
 * One include for every endpoint: output buffering (so a stray warning can
 * never corrupt a JSON body), the shared libraries, and the config check.
 *
 * Usage at the top of an api/* file:
 *   require_once __DIR__ . '/../lib/bootstrap.php';
 *   cors_preflight_and_headers('GET, POST');
 */
ob_start();

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/ids.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

$configPath = getenv('NE_CRM_CONFIG') ?: __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
	header('Content-Type: application/json');
	send_json(['error' => 'Server not configured: missing config.php. See README.md.'], 500);
}
require_once $configPath;
unset($configPath);
