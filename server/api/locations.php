<?php
/**
 * GET  /api/locations            sub-accounts (enabled only; admins see all with ?all=1)
 * PUT  /api/locations            {id, enabled}  admin toggles visibility
 */
require_once __DIR__ . '/../lib/bootstrap.php';
cors_preflight_and_headers('GET, PUT');
require_method('GET', 'PUT');
$user = require_user();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$all = $user['role'] === 'admin' && isset($_GET['all']);
	$rows = list_locations(!$all);
	send_json(['locations' => array_map(fn($l) => [
		'id' => $l['id'], 'name' => $l['name'], 'city' => $l['city'], 'country' => $l['country'], 'timezone' => $l['timezone'],
		'website' => $l['website'], 'enabled' => (bool)$l['enabled'], 'contactCount' => (int)$l['contact_count'], 'syncedAt' => $l['synced_at'],
	], $rows)]);
}

if ($user['role'] !== 'admin') send_json(['error' => 'Admin access required'], 403);
$body = read_json_body();
$id = str_field($body, 'id', 64);
if ($id === '' || !get_location($id)) send_json(['error' => 'Unknown location'], 404);
set_location_enabled($id, !empty($body['enabled']));
send_json(['success' => true]);
