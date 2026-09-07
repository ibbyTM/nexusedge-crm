<?php
/** POST /api/automations/run  {buttonId, contactIds: []}  runs one button for up to 50 contacts */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/automations.php';
cors_preflight_and_headers('POST');
require_method('POST');
$user = require_user();
$body = read_json_body();
$buttonId = str_field($body, 'buttonId', 36);
$button = $buttonId !== '' ? get_button($buttonId) : null;
if (!$button || !$button['enabled']) send_json(['error' => 'Automation not found'], 404);
if (!role_allows($user['role'], $button['min_role'])) send_json(['error' => 'You do not have access to this automation'], 403);
$ids = string_list_field($body, 'contactIds', 50, 64);
if (!$ids) send_json(['error' => 'Select at least one contact.'], 400);
$contacts = get_contacts_by_ids($ids);
if (!$contacts) send_json(['error' => 'No matching contacts'], 404);

$results = [];
foreach ($contacts as $contact) {
	if ($button['location_id'] !== null && $button['location_id'] !== $contact['locationId']) {
		$results[] = ['contactId' => $contact['id'], 'status' => 'failed', 'responseCode' => null, 'detail' => 'This automation belongs to a different sub-account.'];
		continue;
	}
	$results[] = run_button_for_contact($button, $contact, $user);
}
$ok = count(array_filter($results, fn($r) => $r['status'] === 'success'));
send_json(['results' => $results, 'succeeded' => $ok, 'failed' => count($results) - $ok]);
