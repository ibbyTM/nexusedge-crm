<?php
/** POST /api/contact/notes  {id, body} */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/sync.php';
cors_preflight_and_headers('POST');
require_method('POST');
$user = require_user();
$body = read_json_body();
$id = str_field($body, 'id', 64);
$contact = $id !== '' ? get_contact($id) : null;
if (!$contact) send_json(['error' => 'Contact not found'], 404);
$text = isset($body['body']) && is_string($body['body']) ? trim($body['body']) : '';
if ($text === '') send_json(['error' => 'Write something first.'], 400);
if (mb_strlen($text) > 5000) send_json(['error' => 'Notes are limited to 5000 characters.'], 400);
try {
	ghl_create_note($contact['locationId'], $id, $text . "\n\n" . '(' . $user['name'] . ' via NexusEdge CRM)', null);
	$activity = refresh_contact_activity($contact['locationId'], $id);
	send_json(['notes' => $activity['notes']]);
} catch (GhlException $e) {
	send_json(['error' => $e->getMessage()], $e->status >= 400 && $e->status < 600 ? $e->status : 502);
}
