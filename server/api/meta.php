<?php
/** GET /api/meta?locationId=  tags, custom fields, users, workflows, tag counts and buttons for a sub-account. */
require_once __DIR__ . '/../lib/bootstrap.php';
cors_preflight_and_headers('GET');
require_method('GET');
$user = require_user();
$locationId = isset($_GET['locationId']) && is_string($_GET['locationId']) ? trim($_GET['locationId']) : '';
if ($locationId === '' || !get_location($locationId)) send_json(['error' => 'Unknown location'], 404);

$meta = get_location_meta($locationId);
$meta['tagCounts'] = array_map(fn($t) => ['tag' => $t['tag'], 'count' => (int)$t['n']], location_tag_counts($locationId));
$meta['buttons'] = array_values(array_filter(list_buttons($locationId, false), fn($b) => role_allows($user['role'], $b['minRole'])));
$meta['sync'] = [
	'contacts' => get_sync_state($locationId, 'contacts'),
	'meta' => get_sync_state($locationId, 'meta'),
];
send_json($meta);
