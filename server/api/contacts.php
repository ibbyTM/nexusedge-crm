<?php
/**
 * GET  /api/contacts?locationId=&q=&tag=&assignedTo=&sort=&dir=&page=&pageSize=
 * POST /api/contacts  {locationId, firstName, lastName, email, phone, ...}  creates in HighLevel, then mirrors
 */
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/sync.php';
require_once __DIR__ . '/contacts-fields.php';
cors_preflight_and_headers('GET, POST');
require_method('GET', 'POST');
$user = require_user();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$locationId = isset($_GET['locationId']) && is_string($_GET['locationId']) ? trim($_GET['locationId']) : '';
	if ($locationId === '' || !get_location($locationId)) send_json(['error' => 'Unknown location'], 404);
	$result = search_contacts($locationId, [
		'q' => is_string($_GET['q'] ?? null) ? mb_substr($_GET['q'], 0, 200) : '',
		'tag' => is_string($_GET['tag'] ?? null) ? mb_substr($_GET['tag'], 0, 120) : '',
		'assignedTo' => is_string($_GET['assignedTo'] ?? null) ? mb_substr($_GET['assignedTo'], 0, 64) : '',
		'sort' => $_GET['sort'] ?? 'updated',
		'dir' => $_GET['dir'] ?? 'desc',
		'page' => (int)($_GET['page'] ?? 1),
		'pageSize' => (int)($_GET['pageSize'] ?? 50),
	]);
	send_json($result);
}

$body = read_json_body();
$locationId = str_field($body, 'locationId', 64);
if ($locationId === '' || !get_location($locationId)) send_json(['error' => 'Unknown location'], 404);
$fields = pick_contact_fields($body);
if (($fields['firstName'] ?? '') === '' && ($fields['lastName'] ?? '') === '' && ($fields['email'] ?? '') === '' && ($fields['phone'] ?? '') === '') {
	send_json(['error' => 'Enter at least a name, email or phone.'], 400);
}
try {
	$created = ghl_create_contact($locationId, $fields);
	if (empty($created['id'])) send_json(['error' => 'HighLevel did not return the new contact.'], 502);
	$contact = refresh_contact($locationId, $created['id']) ?? (function () use ($created, $locationId) {
		upsert_contact_from_api($created, $locationId);
		return get_contact($created['id']);
	})();
	send_json(['contact' => $contact], 201);
} catch (GhlException $e) {
	send_json(['error' => $e->getMessage()], $e->status >= 400 && $e->status < 600 ? $e->status : 502);
}
