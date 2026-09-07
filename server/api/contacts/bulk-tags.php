<?php
/** POST /api/contacts/bulk-tags  {ids: [], add: [], remove: []}  up to 100 contacts per call */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/sync.php';
cors_preflight_and_headers('POST');
require_method('POST');
$user = require_user();
$body = read_json_body();
$ids = string_list_field($body, 'ids', 100, 64);
$add = string_list_field($body, 'add', 20);
$remove = string_list_field($body, 'remove', 20);
if (!$ids) send_json(['error' => 'Select at least one contact.'], 400);
if (!$add && !$remove) send_json(['error' => 'Nothing to change'], 400);
$contacts = get_contacts_by_ids($ids);
$results = [];
foreach ($contacts as $c) {
	try {
		if ($add) ghl_add_tags($c['locationId'], $c['id'], $add);
		if ($remove) ghl_remove_tags($c['locationId'], $c['id'], $remove);
		refresh_contact($c['locationId'], $c['id']);
		$results[] = ['id' => $c['id'], 'ok' => true];
	} catch (GhlException $e) {
		$results[] = ['id' => $c['id'], 'ok' => false, 'error' => $e->getMessage()];
	}
}
send_json(['results' => $results]);
