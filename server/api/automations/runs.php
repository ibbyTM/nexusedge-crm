<?php
/** GET /api/automations/runs?locationId=&contactId=&status=&page=&pageSize= */
require_once __DIR__ . '/../../lib/bootstrap.php';
cors_preflight_and_headers('GET');
require_method('GET');
require_user();
send_json(list_runs([
	'locationId' => is_string($_GET['locationId'] ?? null) ? $_GET['locationId'] : '',
	'contactId' => is_string($_GET['contactId'] ?? null) ? $_GET['contactId'] : '',
	'status' => in_array($_GET['status'] ?? '', ['success', 'failed'], true) ? $_GET['status'] : '',
	'page' => (int)($_GET['page'] ?? 1),
	'pageSize' => (int)($_GET['pageSize'] ?? 50),
]));
