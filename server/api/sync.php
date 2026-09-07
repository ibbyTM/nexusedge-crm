<?php
/**
 * GET  /api/sync                       sync state for every sub-account (logged-in users)
 * POST /api/sync  {step, locationId?}  run one bounded step. Admin cookie, or ?key=CRON_KEY.
 *   step: "locations" | "meta" | "contacts" (add restart: true to start a fresh pass)
 */
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/sync.php';
cors_preflight_and_headers('GET, POST');
require_method('GET', 'POST');

$cronKeyOk = defined('CRON_KEY') && CRON_KEY !== '' && !str_starts_with(CRON_KEY, 'REPLACE') && isset($_GET['key']) && is_string($_GET['key']) && hash_equals(CRON_KEY, $_GET['key']);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	if (!$cronKeyOk) require_user();
	$states = list_sync_states();
	send_json([
		'states' => array_map(fn($s) => [
			'locationId' => $s['location_id'], 'resource' => $s['resource'], 'status' => $s['status'], 'itemsSynced' => (int)$s['items_synced'],
			'lastStartedAt' => $s['last_started_at'], 'lastFinishedAt' => $s['last_finished_at'], 'lastError' => $s['last_error'],
		], $states),
		'recentWebhooks' => array_map(fn($e) => [
			'id' => $e['id'], 'type' => $e['event_type'], 'source' => $e['source'], 'locationId' => $e['location_id'], 'contactId' => $e['contact_id'],
			'receivedAt' => $e['received_at'], 'processed' => (bool)$e['processed'], 'error' => $e['error'],
		], recent_webhook_events(30)),
	]);
}

if (!$cronKeyOk) require_admin();
$body = read_json_body();
$step = str_field($body, 'step', 20) ?: (is_string($_GET['step'] ?? null) ? $_GET['step'] : '');
$locationId = str_field($body, 'locationId', 64) ?: (is_string($_GET['locationId'] ?? null) ? $_GET['locationId'] : '');
set_time_limit(120);

try {
	switch ($step) {
		case 'locations':
			$n = sync_locations();
			send_json(['step' => 'locations', 'done' => true, 'synced' => $n]);
		case 'meta':
			if ($locationId === '') send_json(['error' => 'locationId is required'], 400);
			send_json(['step' => 'meta', 'done' => true, 'synced' => sync_location_meta($locationId)]);
		case 'contacts':
			if ($locationId === '') send_json(['error' => 'locationId is required'], 400);
			$pages = int_field($body, 'pages', 5, 1, 20);
			$result = sync_contacts_step($locationId, $pages, !empty($body['restart']));
			send_json(['step' => 'contacts'] + $result);
		default:
			send_json(['error' => 'step must be locations, meta or contacts'], 400);
	}
} catch (GhlException $e) {
	send_json(['error' => $e->getMessage(), 'status' => $e->status], 502);
} catch (Throwable $e) {
	error_log('sync failed: ' . $e->getMessage());
	send_json(['error' => 'Sync failed: ' . $e->getMessage()], 500);
}
