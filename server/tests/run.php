<?php
/**
 * Unit tests for the pure PHP pieces: webhook signature checks, session
 * cookies, template rendering, payload parsing and input validation.
 * No database needed. Run: php server/tests/run.php
 */
declare(strict_types=1);

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/ids.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/webhook.php';
require_once __DIR__ . '/../lib/automations.php';

$passed = 0;
$failed = 0;
function check(string $name, bool $ok, string $detail = ''): void {
	global $passed, $failed;
	if ($ok) { $passed++; echo "  ok   $name\n"; }
	else { $failed++; echo "  FAIL $name" . ($detail !== '' ? " ($detail)" : '') . "\n"; }
}
function eq(string $name, $expected, $actual): void {
	check($name, $expected === $actual, 'expected ' . json_encode($expected) . ' got ' . json_encode($actual));
}

echo "webhook signatures\n";
$body = json_encode(['timestamp' => gmdate('c'), 'webhookId' => 'abc', 'type' => 'ContactUpdate', 'id' => 'c1', 'locationId' => 'l1']);
$keypair = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
openssl_sign($body, $sig, $keypair, OPENSSL_ALGO_SHA256);
$pub = openssl_pkey_get_details($keypair)['key'];
check('rsa: valid signature verifies', verify_rsa_signature($body, base64_encode($sig), $pub));
check('rsa: tampered body fails', !verify_rsa_signature($body . ' ', base64_encode($sig), $pub));
check('rsa: garbage signature fails', !verify_rsa_signature($body, 'not-base64!!', $pub));
check('rsa: signature made with another key fails against the HighLevel key', !verify_rsa_signature($body, base64_encode($sig)));
check('rsa: built-in HighLevel key parses', openssl_pkey_get_public(GHL_WEBHOOK_RSA_PUBLIC_KEY) !== false);

if (function_exists('sodium_crypto_sign_keypair')) {
	$kp = sodium_crypto_sign_keypair();
	$sk = sodium_crypto_sign_secretkey($kp);
	$pk = sodium_crypto_sign_publickey($kp);
	$edSig = base64_encode(sodium_crypto_sign_detached($body, $sk));
	check('ed25519: raw key verifies', verify_ed25519_signature($body, $edSig, $pk));
	check('ed25519: hex key verifies', verify_ed25519_signature($body, $edSig, bin2hex($pk)));
	check('ed25519: base64 key verifies', verify_ed25519_signature($body, $edSig, base64_encode($pk)));
	$spki = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin('302a300506032b6570032100') . $pk), 64, "\n") . "-----END PUBLIC KEY-----";
	check('ed25519: PEM SPKI key verifies', verify_ed25519_signature($body, $edSig, $spki));
	check('ed25519: tampered body fails', !verify_ed25519_signature($body . 'x', $edSig, $pk));
} else {
	echo "  skip ed25519 (sodium missing)\n";
}

echo "replay window\n";
check('timestamp within window ok', webhook_timestamp_ok(['timestamp' => gmdate('c', time() - 60)]));
check('timestamp too old rejected', !webhook_timestamp_ok(['timestamp' => gmdate('c', time() - 3600)]));
check('missing timestamp tolerated', webhook_timestamp_ok(['type' => 'x']));
check('unparseable timestamp rejected', !webhook_timestamp_ok(['timestamp' => 'yesterday-ish']));

echo "payload parsing\n";
$t = extract_webhook_target(['type' => 'ContactTagUpdate', 'locationId' => 'L', 'id' => 'C', 'webhookId' => 'W']);
eq('app shape: type', 'ContactTagUpdate', $t['type']);
eq('app shape: location', 'L', $t['locationId']);
eq('app shape: contact', 'C', $t['contactId']);
eq('app shape: webhookId', 'W', $t['webhookId']);
$t = extract_webhook_target(['contact_id' => 'C2', 'first_name' => 'Ivy', 'location' => ['id' => 'L2'], 'customData' => ['event' => 'ContactCreate']]);
eq('workflow shape: contact', 'C2', $t['contactId']);
eq('workflow shape: location', 'L2', $t['locationId']);
eq('workflow shape: type from customData', 'ContactCreate', $t['type']);
$t = extract_webhook_target(['id' => 'C3', 'email' => 'a@b.c', 'location_id' => 'L3']);
eq('bare contact shape: contact', 'C3', $t['contactId']);
eq('bare contact shape: location', 'L3', $t['locationId']);
$t = extract_webhook_target(['type' => 'InvoicePaid', 'id' => 'inv1', 'locationId' => 'L']);
eq('non-contact event has no contact id', null, $t['contactId']);

echo "session cookies\n";
$secret = 'test-secret';
$exp = time() + 100;
$payload = rtrim(strtr(base64_encode(json_encode(['uid' => 'user-1', 'exp' => $exp])), '+/', '-_'), '=');
$cookie = $payload . '.' . hash_hmac('sha256', $payload, $secret);
eq('valid cookie yields uid', 'user-1', session_user_id_from_cookie($cookie, $secret));
eq('wrong secret rejected', null, session_user_id_from_cookie($cookie, 'other'));
eq('tampered payload rejected', null, session_user_id_from_cookie('x' . $cookie, $secret));
$old = rtrim(strtr(base64_encode(json_encode(['uid' => 'user-1', 'exp' => time() - 1])), '+/', '-_'), '=');
eq('expired cookie rejected', null, session_user_id_from_cookie($old . '.' . hash_hmac('sha256', $old, $secret), $secret));
eq('garbage rejected', null, session_user_id_from_cookie('nope', $secret));
check('role_allows: admin >= member', role_allows('admin', 'member'));
check('role_allows: member < admin', !role_allows('member', 'admin'));
check('role_allows: unknown role denied', !role_allows('guest', 'member'));

echo "templates\n";
$vars = ['contact' => ['firstName' => 'Ivy', 'tags' => ['a', 'b'], 'dnd' => false, 'email' => null], 'user' => ['name' => 'Sam']];
eq('simple placeholder', 'Hi Ivy', render_template('Hi {{contact.firstName}}', $vars));
eq('spaces inside braces', 'Hi Ivy', render_template('Hi {{ contact.firstName }}', $vars));
eq('array becomes json', '["a","b"]', render_template('{{contact.tags}}', $vars));
eq('bool becomes text', 'false', render_template('{{contact.dnd}}', $vars));
eq('null becomes empty', '', render_template('{{contact.email}}', $vars));
eq('unknown path becomes empty', '', render_template('{{contact.nothing.here}}', $vars));
eq('nested user value', 'by Sam', render_template('by {{user.name}}', $vars));

echo "button validation\n";
[$row, $err] = normalize_button_input(['label' => 'Go', 'mechanism' => 'workflow', 'workflowId' => 'wf1']);
check('workflow button ok', $err === null && $row['workflow_id'] === 'wf1' && $row['location_id'] === null);
[, $err] = normalize_button_input(['label' => '', 'mechanism' => 'workflow', 'workflowId' => 'wf1']);
check('label required', $err !== null);
[, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'teleport']);
check('unknown mechanism rejected', $err !== null);
[, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'webhook', 'webhookUrl' => 'http://insecure.example']);
check('http webhook rejected', $err !== null);
[$row, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'webhook', 'webhookUrl' => 'https://ok.example/hook', 'payloadTemplate' => '{"e": "{{contact.email}}"}', 'icon' => 'rocket', 'minRole' => 'admin', 'sortOrder' => 5]);
check('webhook button ok', $err === null && $row['icon'] === 'rocket' && $row['min_role'] === 'admin' && $row['sort_order'] === 5);
[, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'webhook', 'webhookUrl' => 'https://ok.example/hook', 'payloadTemplate' => '{"broken": ']);
check('invalid json template rejected', $err !== null);
[$row, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'tag', 'tagName' => 'hot', 'icon' => 'not-an-icon', 'enabled' => false]);
check('tag button ok, icon falls back, disabled honoured', $err === null && $row['icon'] === 'zap' && $row['tag_name'] === 'hot' && $row['enabled'] === false);
[, $err] = normalize_button_input(['label' => 'x', 'mechanism' => 'tag']);
check('tag required for tag mechanism', $err !== null);

echo "helpers\n";
eq('iso_or_null normalises', '2026-01-02T03:04:05.000Z', iso_or_null('2026-01-02T03:04:05+00:00'));
eq('iso_or_null rejects junk', null, iso_or_null('not a date'));
eq('iso_or_null rejects empty', null, iso_or_null(''));
check('uuid4 shape', (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', generate_uuid4()));
eq('string_list_field dedupes and trims', ['a', 'b'], string_list_field(['t' => [' a', 'b', 'a', '', 7]], 't'));
eq('int_field clamps', 20, int_field(['n' => 999], 'n', 5, 1, 20));
eq('int_field accepts numeric strings', 7, int_field(['n' => '7'], 'n', 5, 1, 20));
eq('int_field default on junk', 5, int_field(['n' => 'x'], 'n', 5, 1, 20));

echo "\n$passed passed, $failed failed\n";
exit($failed === 0 ? 0 : 1);
