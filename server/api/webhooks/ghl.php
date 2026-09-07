<?php
/**
 * POST /api/webhooks/ghl?key=GHL_WEBHOOK_KEY
 *
 * Receives change notifications and refreshes the mirrored contact.
 * See lib/webhook.php for the accepted senders and how they are verified.
 */
require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/webhook.php';
require_once __DIR__ . '/../../lib/sync.php';
header('Content-Type: application/json');
require_method('POST');

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) send_json(['error' => 'Body must be JSON'], 400);

$source = null;
$key = isset($_GET['key']) && is_string($_GET['key']) ? $_GET['key'] : '';
if ($key !== '' && defined('GHL_WEBHOOK_KEY') && GHL_WEBHOOK_KEY !== '' && !str_starts_with(GHL_WEBHOOK_KEY, 'REPLACE') && hash_equals(GHL_WEBHOOK_KEY, $key)) {
	$source = 'workflow';
} else {
	$ghlSig = $_SERVER['HTTP_X_GHL_SIGNATURE'] ?? '';
	$whSig = $_SERVER['HTTP_X_WH_SIGNATURE'] ?? '';
	if ($ghlSig !== '' && defined('GHL_ED25519_PUBLIC_KEY') && GHL_ED25519_PUBLIC_KEY !== '' && verify_ed25519_signature($raw, $ghlSig, GHL_ED25519_PUBLIC_KEY)) {
		$source = 'app';
	} elseif ($whSig !== '' && verify_rsa_signature($raw, $whSig)) {
		$source = 'app';
	}
	if ($source === 'app' && !webhook_timestamp_ok($payload)) {
		send_json(['error' => 'Stale timestamp'], 401);
	}
}
if ($source === null) send_json(['error' => 'Unauthorized'], 401);

$target = extract_webhook_target($payload);
$eventId = generate_uuid4();
$isNew = record_webhook_event([
	'id' => $eventId,
	'webhook_id' => $target['webhookId'],
	'event_type' => $target['type'],
	'source' => $source,
	'location_id' => $target['locationId'],
	'contact_id' => $target['contactId'],
]);
if (!$isNew) send_json(['ok' => true, 'duplicate' => true]);

$error = null;
try {
	$type = $target['type'] ?? '';
	if ($target['contactId'] === null) {
		$error = 'No contact id in payload';
	} elseif ($type === 'ContactDelete') {
		mark_contact_deleted($target['contactId']);
	} else {
		$locationId = $target['locationId'];
		if ($locationId === null) {
			$existing = get_contact($target['contactId']);
			$locationId = $existing['locationId'] ?? null;
		}
		if ($locationId === null) {
			$error = 'No location id in payload and contact not mirrored yet';
		} else {
			if (!get_location($locationId)) {
				try { upsert_location(ghl_get_location($locationId)['location'] ?? ['id' => $locationId, 'name' => $locationId]); } catch (Throwable $e) { upsert_location(['id' => $locationId, 'name' => $locationId]); }
			}
			refresh_contact($locationId, $target['contactId']);
		}
	}
} catch (Throwable $e) {
	$error = $e->getMessage();
}
finish_webhook_event($eventId, $error);
send_json(['ok' => $error === null, 'error' => $error]);
