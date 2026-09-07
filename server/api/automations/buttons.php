<?php
/**
 * GET    /api/automations/buttons?locationId=   buttons a user may run (all, for admins, with ?all=1)
 * POST   /api/automations/buttons               admin creates
 * PUT    /api/automations/buttons               admin updates {id, ...}
 * DELETE /api/automations/buttons               admin deletes {id}
 */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/automations.php';
cors_preflight_and_headers('GET, POST, PUT, DELETE');
require_method('GET', 'POST', 'PUT', 'DELETE');
$user = require_user();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$locationId = isset($_GET['locationId']) && is_string($_GET['locationId']) && $_GET['locationId'] !== '' ? $_GET['locationId'] : null;
	$all = $user['role'] === 'admin' && isset($_GET['all']);
	$buttons = list_buttons($all ? null : $locationId, $all);
	if (!$all) $buttons = array_values(array_filter($buttons, fn($b) => role_allows($user['role'], $b['minRole'])));
	send_json(['buttons' => $buttons, 'icons' => BUTTON_ICONS]);
}

if ($user['role'] !== 'admin') send_json(['error' => 'Admin access required'], 403);
$body = read_json_body();

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
	$id = str_field($body, 'id', 36);
	if ($id === '' || !get_button($id)) send_json(['error' => 'Button not found'], 404);
	delete_button($id);
	send_json(['success' => true]);
}

[$row, $error] = normalize_button_input($body);
if ($error) send_json(['error' => $error], 400);
if ($row['location_id'] !== null && !get_location($row['location_id'])) send_json(['error' => 'Unknown location'], 404);
if ($row['mechanism'] === 'workflow') {
	$wf = get_workflow($row['workflow_id']);
	if (!$wf) send_json(['error' => 'That workflow is not in the synced list. Run a sync first.'], 400);
	if ($row['location_id'] === null) $row['location_id'] = $wf['location_id'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$id = insert_button($row);
	send_json(['button' => button_row_to_json(get_button($id))], 201);
}

$id = str_field($body, 'id', 36);
if ($id === '' || !get_button($id)) send_json(['error' => 'Button not found'], 404);
update_button($id, $row);
send_json(['button' => button_row_to_json(get_button($id))]);
