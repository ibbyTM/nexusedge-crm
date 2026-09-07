<?php
/**
 * GET    /api/contact?id=            contact from the mirror plus live notes/tasks (add &refresh=1 to re-fetch the contact too)
 * PUT    /api/contact  {id, ...fields}  update in HighLevel, then mirror
 * DELETE /api/contact  {id}            delete in HighLevel (admin only)
 */
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/sync.php';
require_once __DIR__ . '/contacts-fields.php';
cors_preflight_and_headers('GET, PUT, DELETE');
require_method('GET', 'PUT', 'DELETE');
$user = require_user();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$id = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
	if ($id === '') send_json(['error' => 'Missing id'], 400);
	$contact = get_contact($id);
	$warning = null;
	if (!$contact || isset($_GET['refresh'])) {
		// Not mirrored yet (or a refresh was asked for): the location is
		// needed for the token choice, so try the mirror's, else every enabled one.
		$candidates = $contact ? [$contact['locationId']] : array_column(list_locations(true), 'id');
		foreach ($candidates as $loc) {
			try {
				$fresh = refresh_contact($loc, $id);
				if ($fresh) { $contact = $fresh; break; }
			} catch (GhlException $e) {
				$warning = $e->getMessage();
			}
		}
	}
	if (!$contact) send_json(['error' => 'Contact not found'], 404);
	$activity = ['notes' => get_contact_notes($id), 'tasks' => get_contact_tasks($id)];
	try {
		$activity = refresh_contact_activity($contact['locationId'], $id);
	} catch (GhlException $e) {
		$warning = $warning ?? $e->getMessage();
	}
	$runs = list_runs(['contactId' => $id, 'pageSize' => 20])['runs'];
	send_json(['contact' => $contact, 'notes' => $activity['notes'], 'tasks' => $activity['tasks'], 'runs' => $runs, 'warning' => $warning]);
}

$body = read_json_body();
$id = str_field($body, 'id', 64);
if ($id === '') send_json(['error' => 'Missing id'], 400);
$existing = get_contact($id);
if (!$existing) send_json(['error' => 'Contact not found'], 404);
$locationId = $existing['locationId'];

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
	if ($user['role'] !== 'admin') send_json(['error' => 'Admin access required'], 403);
	try {
		ghl_delete_contact($locationId, $id);
		mark_contact_deleted($id);
		send_json(['success' => true]);
	} catch (GhlException $e) {
		send_json(['error' => $e->getMessage()], $e->status >= 400 && $e->status < 600 ? $e->status : 502);
	}
}

$fields = pick_contact_fields($body);
unset($fields['tags']); // tags go through /api/contact/tags so they are never overwritten wholesale
if (!$fields) send_json(['error' => 'Nothing to update'], 400);
try {
	ghl_update_contact($locationId, $id, $fields);
	$contact = refresh_contact($locationId, $id);
	send_json(['contact' => $contact]);
} catch (GhlException $e) {
	send_json(['error' => $e->getMessage()], $e->status >= 400 && $e->status < 600 ? $e->status : 502);
}
