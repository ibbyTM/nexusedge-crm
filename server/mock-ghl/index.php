<?php
/**
 * A small stand-in for the HighLevel API, for local development and tests.
 * Serves the endpoints the CRM uses with realistic shapes and cursor paging.
 * State lives in a JSON file so it survives across requests.
 *
 *   php -S 127.0.0.1:8090 server/mock-ghl/index.php
 *   then set GHL_API_BASE = 'http://127.0.0.1:8090' in server/config.php
 */
$stateFile = getenv('MOCK_GHL_STATE') ?: sys_get_temp_dir() . '/mock-ghl-state.json';

function seed_state(): array {
	mt_srand(42);
	$first = ['Amelia', 'Oliver', 'Isla', 'George', 'Ava', 'Noah', 'Ivy', 'Leo', 'Freya', 'Arthur', 'Grace', 'Oscar', 'Poppy', 'Harry', 'Ella', 'Jack', 'Mia', 'Charlie', 'Lily', 'Jacob'];
	$last = ['Patel', 'Hughes', 'Okafor', 'Murphy', 'Nguyen', 'Walsh', 'Khan', 'Evans', 'Roberts', 'Campbell', 'Ahmed', 'Baker', 'Silva', 'Carter', 'Moore'];
	$tagPool = ['lead', 'client', 'newsletter', 'hot', 'demo-booked', 'no-answer', 'referral', 'vip'];
	$sources = ['website form', 'referral', 'cold outreach', 'webinar', 'linkedin'];
	$locations = [
		['id' => 'loc_nexusedge_hq', 'name' => 'NexusEdge HQ', 'city' => 'London', 'country' => 'GB', 'timezone' => 'Europe/London', 'website' => 'https://nexusedge.tech', 'email' => 'hello@nexusedge.tech', 'phone' => '+442071234567'],
		['id' => 'loc_bright_dental', 'name' => 'Bright Dental Group', 'city' => 'Manchester', 'country' => 'GB', 'timezone' => 'Europe/London', 'website' => 'https://example.com', 'email' => 'front@example.com', 'phone' => '+441611234567'],
	];
	$state = ['locations' => $locations, 'contacts' => [], 'notes' => [], 'tasks' => [], 'workflows' => [], 'tags' => [], 'customFields' => [], 'users' => [], 'workflowEnrolments' => [], 'inboundHooks' => []];
	foreach ($locations as $li => $loc) {
		$lid = $loc['id'];
		$state['tags'][$lid] = array_map(fn($t, $i) => ['id' => "tag_{$li}_$i", 'name' => $t, 'locationId' => $lid], $tagPool, array_keys($tagPool));
		$state['customFields'][$lid] = [
			['id' => "cf_{$li}_budget", 'name' => 'Monthly budget', 'fieldKey' => 'contact.monthly_budget', 'dataType' => 'TEXT', 'placeholder' => '2000', 'position' => 0, 'model' => 'contact'],
			['id' => "cf_{$li}_stage", 'name' => 'Lead stage', 'fieldKey' => 'contact.lead_stage', 'dataType' => 'SINGLE_OPTIONS', 'position' => 1, 'picklistOptions' => ['New', 'Qualified', 'Proposal', 'Won', 'Lost'], 'model' => 'contact'],
			['id' => "cf_{$li}_notes", 'name' => 'Fit notes', 'fieldKey' => 'contact.fit_notes', 'dataType' => 'LARGE_TEXT', 'position' => 2, 'model' => 'contact'],
		];
		$state['users'][$lid] = [
			['id' => "usr_{$li}_1", 'name' => 'Ibrahim M', 'firstName' => 'Ibrahim', 'lastName' => 'M', 'email' => 'ibrahim@nexusedge.tech', 'roles' => ['type' => 'account', 'role' => 'admin']],
			['id' => "usr_{$li}_2", 'name' => 'Sam Rivers', 'firstName' => 'Sam', 'lastName' => 'Rivers', 'email' => 'sam@nexusedge.tech', 'roles' => ['type' => 'account', 'role' => 'user']],
		];
		$state['workflows'][$lid] = [
			['id' => "wf_{$li}_speed", 'name' => 'Speed to lead: instant reply', 'status' => 'published', 'version' => 3, 'createdAt' => '2026-03-01T10:00:00.000Z', 'updatedAt' => '2026-08-20T09:00:00.000Z', 'locationId' => $lid],
			['id' => "wf_{$li}_nurture", 'name' => '14 day nurture sequence', 'status' => 'published', 'version' => 7, 'createdAt' => '2026-02-11T10:00:00.000Z', 'updatedAt' => '2026-08-01T09:00:00.000Z', 'locationId' => $lid],
			['id' => "wf_{$li}_review", 'name' => 'Review request', 'status' => 'published', 'version' => 1, 'createdAt' => '2026-05-11T10:00:00.000Z', 'updatedAt' => '2026-05-11T10:00:00.000Z', 'locationId' => $lid],
			['id' => "wf_{$li}_draft", 'name' => 'Reactivation (draft)', 'status' => 'draft', 'version' => 1, 'createdAt' => '2026-08-30T10:00:00.000Z', 'updatedAt' => '2026-08-30T10:00:00.000Z', 'locationId' => $lid],
		];
		$count = $li === 0 ? 137 : 64;
		for ($i = 0; $i < $count; $i++) {
			$f = $first[mt_rand(0, count($first) - 1)];
			$l = $last[mt_rand(0, count($last) - 1)];
			$tags = array_values(array_unique(array_filter([$tagPool[mt_rand(0, 7)], mt_rand(0, 1) ? $tagPool[mt_rand(0, 7)] : null])));
			$added = gmdate('Y-m-d\TH:i:s.000\Z', strtotime('2026-01-01') + mt_rand(0, 240 * 86400));
			$updated = gmdate('Y-m-d\TH:i:s.000\Z', strtotime($added) + mt_rand(0, 20 * 86400));
			$id = sprintf('ct_%d_%03d', $li, $i);
			$state['contacts'][$id] = [
				'id' => $id, 'locationId' => $lid, 'firstName' => $f, 'lastName' => $l, 'name' => "$f $l",
				'email' => strtolower("$f.$l" . ($i ? $i : '')) . '@example.com', 'phone' => '+4477' . sprintf('%08d', mt_rand(0, 99999999)),
				'companyName' => mt_rand(0, 2) ? ['Acme Lettings', 'Northwind Clinics', 'Bluebird Estates', 'Harbour Legal', 'Pixel Forge'][mt_rand(0, 4)] : null,
				'address1' => null, 'city' => ['London', 'Leeds', 'Bristol', 'Glasgow'][mt_rand(0, 3)], 'state' => null, 'country' => 'GB', 'postalCode' => null, 'website' => null,
				'timezone' => 'Europe/London', 'source' => $sources[mt_rand(0, 4)], 'assignedTo' => mt_rand(0, 1) ? "usr_{$li}_1" : "usr_{$li}_2",
				'dnd' => mt_rand(0, 9) === 0, 'tags' => $tags,
				'customFields' => [['id' => "cf_{$li}_budget", 'value' => (string)(mt_rand(5, 60) * 100)], ['id' => "cf_{$li}_stage", 'value' => ['New', 'Qualified', 'Proposal', 'Won', 'Lost'][mt_rand(0, 4)]]],
				'dateAdded' => $added, 'dateUpdated' => $updated, 'lastActivity' => $updated,
			];
			if ($i % 9 === 0) {
				$state['notes'][$id] = [['id' => "note_{$id}_1", 'body' => 'Spoke on the phone, wants a proposal by Friday.', 'userId' => "usr_{$li}_1", 'dateAdded' => $updated, 'contactId' => $id]];
				$state['tasks'][$id] = [['id' => "task_{$id}_1", 'title' => 'Send proposal', 'body' => 'Include the nurture add-on', 'assignedTo' => "usr_{$li}_1", 'dueDate' => gmdate('Y-m-d\TH:i:s.000\Z', strtotime($updated) + 3 * 86400), 'completed' => false, 'contactId' => $id]];
			}
		}
	}
	return $state;
}

function load_state(string $file): array {
	if (is_file($file)) {
		$s = json_decode(file_get_contents($file), true);
		if (is_array($s)) return $s;
	}
	$s = seed_state();
	file_put_contents($file, json_encode($s));
	return $s;
}
function save_state(string $file, array $s): void { file_put_contents($file, json_encode($s)); }
function out($body, int $status = 200): void {
	http_response_code($status);
	header('Content-Type: application/json');
	echo json_encode($body);
	exit;
}
function body(): array { $b = json_decode(file_get_contents('php://input'), true); return is_array($b) ? $b : []; }

$method = $_SERVER['REQUEST_METHOD'];
$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (str_starts_with($path, '/hooks/')) {
	// Stand-in for a workflow "Inbound Webhook" trigger URL.
	$s = load_state($stateFile);
	$s['inboundHooks'][] = ['path' => $path, 'body' => body(), 'at' => gmdate('c')];
	save_state($stateFile, $s);
	out(['status' => 'Success: request sent to trigger execution server', 'id' => uniqid()]);
}
if ($path === '/__reset') { @unlink($stateFile); out(['reset' => true]); }
if ($path === '/__state') { out(load_state($stateFile)); }
if (!str_starts_with($auth, 'Bearer ') || strlen($auth) < 12) out(['statusCode' => 401, 'message' => 'Invalid token'], 401);
if (!isset($_SERVER['HTTP_VERSION'])) out(['statusCode' => 400, 'message' => 'Version header is required'], 400);
$bearer = substr($auth, 7);
// MOCK_GHL_AGENCY_MODE=1 mimics HighLevel: the agency token may only list
// locations and mint sub-account tokens; everything else needs a loc- token.
if (getenv('MOCK_GHL_AGENCY_MODE')) {
	$agencyOnly = in_array($path, ['/locations/search', '/oauth/locationToken'], true) || preg_match('#^/locations/[^/]+$#', $path);
	if (!$agencyOnly && !str_starts_with($bearer, 'loc-')) out(['statusCode' => 401, 'message' => 'The token is not authorized for this scope.'], 401);
	if ($path === '/oauth/locationToken') {
		parse_str(file_get_contents('php://input'), $form);
		if (($form['companyId'] ?? '') !== 'comp_nexusedge' || empty($form['locationId'])) out(['statusCode' => 422, 'message' => 'companyId and locationId are required'], 422);
		out(['access_token' => 'loc-' . $form['locationId'] . '-' . substr(md5((string)time()), 0, 6), 'token_type' => 'Bearer', 'expires_in' => 86399, 'scope' => 'contacts.readonly contacts.write', 'locationId' => $form['locationId']]);
	}
}
if (getenv('MOCK_GHL_FLAKY') && mt_rand(1, 10) === 1) { header('Retry-After: 1'); out(['statusCode' => 429, 'message' => 'Too many requests'], 429); }

$s = load_state($stateFile);

if ($path === '/locations/search' && $method === 'GET') {
	out(['locations' => array_map(fn($l) => $l + ['address' => null, 'state' => null, 'postalCode' => null, 'companyId' => 'comp_nexusedge'], $s['locations'])]);
}
if (preg_match('#^/locations/([^/]+)$#', $path, $m) && $method === 'GET') {
	foreach ($s['locations'] as $l) if ($l['id'] === $m[1]) out(['location' => $l + ['companyId' => 'comp_nexusedge']]);
	out(['statusCode' => 404, 'message' => 'Location not found'], 404);
}
if (preg_match('#^/locations/([^/]+)/tags$#', $path, $m) && $method === 'GET') out(['tags' => $s['tags'][$m[1]] ?? []]);
if (preg_match('#^/locations/([^/]+)/customFields$#', $path, $m) && $method === 'GET') out(['customFields' => $s['customFields'][$m[1]] ?? []]);
if ($path === '/users' && $method === 'GET') out(['users' => $s['users'][$_GET['locationId'] ?? ''] ?? []]);
if ($path === '/workflows' && $method === 'GET') out(['workflows' => $s['workflows'][$_GET['locationId'] ?? ''] ?? []]);

if ($path === '/contacts' && $method === 'GET') {
	$lid = $_GET['locationId'] ?? '';
	$limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
	$rows = array_values(array_filter($s['contacts'], fn($c) => $c['locationId'] === $lid));
	usort($rows, fn($a, $b) => strcmp($a['dateAdded'] . $a['id'], $b['dateAdded'] . $b['id']));
	$start = 0;
	if (!empty($_GET['startAfterId'])) {
		foreach ($rows as $i => $c) if ($c['id'] === $_GET['startAfterId']) { $start = $i + 1; break; }
	}
	$page = array_slice($rows, $start, $limit);
	$meta = ['total' => count($rows), 'currentPage' => intdiv($start, $limit) + 1];
	if ($page) {
		$lastC = $page[count($page) - 1];
		$meta['startAfterId'] = $lastC['id'];
		$meta['startAfter'] = strtotime($lastC['dateAdded']) * 1000;
		$meta['nextPageUrl'] = ($start + $limit < count($rows)) ? 'x' : null;
	}
	out(['contacts' => $page, 'meta' => $meta]);
}
if ($path === '/contacts' && $method === 'POST') {
	$b = body();
	$id = 'ct_new_' . substr(md5(uniqid('', true)), 0, 8);
	$now = gmdate('Y-m-d\TH:i:s.000\Z');
	$c = ['id' => $id, 'locationId' => $b['locationId'] ?? 'loc_nexusedge_hq', 'firstName' => $b['firstName'] ?? null, 'lastName' => $b['lastName'] ?? null,
		'name' => trim(($b['firstName'] ?? '') . ' ' . ($b['lastName'] ?? '')), 'email' => $b['email'] ?? null, 'phone' => $b['phone'] ?? null, 'companyName' => $b['companyName'] ?? null,
		'address1' => $b['address1'] ?? null, 'city' => $b['city'] ?? null, 'state' => $b['state'] ?? null, 'country' => $b['country'] ?? null, 'postalCode' => $b['postalCode'] ?? null,
		'website' => $b['website'] ?? null, 'timezone' => $b['timezone'] ?? null, 'source' => $b['source'] ?? 'public api', 'assignedTo' => $b['assignedTo'] ?? null, 'dnd' => !empty($b['dnd']),
		'tags' => $b['tags'] ?? [], 'customFields' => array_map(fn($f) => ['id' => $f['id'], 'value' => $f['field_value'] ?? $f['value'] ?? null], $b['customFields'] ?? []),
		'dateAdded' => $now, 'dateUpdated' => $now, 'lastActivity' => $now];
	$s['contacts'][$id] = $c;
	save_state($stateFile, $s);
	out(['contact' => $c], 201);
}
if (preg_match('#^/contacts/([^/]+)$#', $path, $m)) {
	$id = $m[1];
	if (!isset($s['contacts'][$id])) out(['statusCode' => 404, 'message' => 'Contact not found'], 404);
	if ($method === 'GET') out(['contact' => $s['contacts'][$id]]);
	if ($method === 'DELETE') { unset($s['contacts'][$id]); save_state($stateFile, $s); out(['succeded' => true]); }
	if ($method === 'PUT') {
		$b = body();
		foreach (['firstName', 'lastName', 'name', 'email', 'phone', 'companyName', 'address1', 'city', 'state', 'country', 'postalCode', 'website', 'timezone', 'source', 'assignedTo', 'dnd', 'tags'] as $k) {
			if (array_key_exists($k, $b)) $s['contacts'][$id][$k] = $b[$k];
		}
		if (isset($b['customFields'])) {
			$existing = [];
			foreach ($s['contacts'][$id]['customFields'] as $f) $existing[$f['id']] = $f['value'];
			foreach ($b['customFields'] as $f) $existing[$f['id']] = $f['field_value'] ?? $f['value'] ?? null;
			$s['contacts'][$id]['customFields'] = array_map(fn($k, $v) => ['id' => $k, 'value' => $v], array_keys($existing), $existing);
		}
		if (isset($b['firstName']) || isset($b['lastName'])) $s['contacts'][$id]['name'] = trim(($s['contacts'][$id]['firstName'] ?? '') . ' ' . ($s['contacts'][$id]['lastName'] ?? ''));
		$s['contacts'][$id]['dateUpdated'] = gmdate('Y-m-d\TH:i:s.000\Z');
		save_state($stateFile, $s);
		out(['succeded' => true, 'contact' => $s['contacts'][$id]]);
	}
}
if (preg_match('#^/contacts/([^/]+)/tags$#', $path, $m)) {
	$id = $m[1];
	if (!isset($s['contacts'][$id])) out(['statusCode' => 404, 'message' => 'Contact not found'], 404);
	$tags = body()['tags'] ?? [];
	$cur = $s['contacts'][$id]['tags'];
	$s['contacts'][$id]['tags'] = $method === 'POST' ? array_values(array_unique(array_merge($cur, $tags))) : array_values(array_diff($cur, $tags));
	$s['contacts'][$id]['dateUpdated'] = gmdate('Y-m-d\TH:i:s.000\Z');
	save_state($stateFile, $s);
	out(['tags' => $s['contacts'][$id]['tags'], 'tagsAdded' => $tags]);
}
if (preg_match('#^/contacts/([^/]+)/notes$#', $path, $m)) {
	$id = $m[1];
	if ($method === 'GET') out(['notes' => $s['notes'][$id] ?? []]);
	$b = body();
	$note = ['id' => 'note_' . uniqid(), 'body' => $b['body'] ?? '', 'userId' => $b['userId'] ?? null, 'dateAdded' => gmdate('Y-m-d\TH:i:s.000\Z'), 'contactId' => $id];
	$s['notes'][$id] = array_merge([$note], $s['notes'][$id] ?? []);
	save_state($stateFile, $s);
	out(['note' => $note], 201);
}
if (preg_match('#^/contacts/([^/]+)/tasks$#', $path, $m) && $method === 'GET') out(['tasks' => $s['tasks'][$m[1]] ?? []]);
if (preg_match('#^/contacts/([^/]+)/workflow/([^/]+)$#', $path, $m)) {
	$id = $m[1];
	if (!isset($s['contacts'][$id])) out(['statusCode' => 404, 'message' => 'Contact not found'], 404);
	$known = false;
	foreach ($s['workflows'] as $list) foreach ($list as $w) if ($w['id'] === $m[2]) $known = true;
	if (!$known) out(['statusCode' => 400, 'message' => 'Workflow not found'], 400);
	if ($method === 'POST') { $s['workflowEnrolments'][] = ['contactId' => $id, 'workflowId' => $m[2], 'eventStartTime' => body()['eventStartTime'] ?? null]; save_state($stateFile, $s); out(['succeded' => true]); }
	if ($method === 'DELETE') out(['succeded' => true]);
}
out(['statusCode' => 404, 'message' => "No mock for $method $path"], 404);
