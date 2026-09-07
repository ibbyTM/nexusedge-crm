<?php
/** POST /api/contact/tags  {id, add: [], remove: []} */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/sync.php';
cors_preflight_and_headers('POST');
require_method('POST');
$user = require_user();
$body = read_json_body();
$id = str_field($body, 'id', 64);
$contact = $id !== '' ? get_contact($id) : null;
if (!$contact) send_json(['error' => 'Contact not found'], 404);
$add = string_list_field($body, 'add', 50);
$remove = string_list_field($body, 'remove', 50);
if (!$add && !$remove) send_json(['error' => 'Nothing to change'], 400);
try {
	if ($add) ghl_add_tags($contact['locationId'], $id, $add);
	if ($remove) ghl_remove_tags($contact['locationId'], $id, $remove);
	send_json(['contact' => refresh_contact($contact['locationId'], $id)]);
} catch (GhlException $e) {
	send_json(['error' => $e->getMessage()], $e->status >= 400 && $e->status < 600 ? $e->status : 502);
}
