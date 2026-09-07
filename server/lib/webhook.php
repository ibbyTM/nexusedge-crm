<?php
/**
 * Inbound change notifications from HighLevel.
 *
 * Two senders are accepted:
 *  1. A workflow "Webhook" action (the normal path for a Private Integration).
 *     Authenticated by the shared secret in ?key= (GHL_WEBHOOK_KEY).
 *  2. Marketplace-app webhooks, signed with x-wh-signature (RSA-SHA256, key
 *     below) or x-ghl-signature (Ed25519, GHL_ED25519_PUBLIC_KEY).
 *
 * Whatever the shape, the handler only extracts the location and contact id,
 * then re-fetches the contact from the API. That keeps the mirror correct no
 * matter which fields the sender chose to include.
 */

const GHL_WEBHOOK_RSA_PUBLIC_KEY = <<<PEM
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----
PEM;

const WEBHOOK_TIMESTAMP_WINDOW = 300; // seconds

function verify_rsa_signature(string $rawBody, string $signatureBase64, string $publicKeyPem = GHL_WEBHOOK_RSA_PUBLIC_KEY): bool {
	$signature = base64_decode($signatureBase64, true);
	if ($signature === false) return false;
	$key = openssl_pkey_get_public($publicKeyPem);
	if ($key === false) return false;
	return openssl_verify($rawBody, $signature, $key, OPENSSL_ALGO_SHA256) === 1;
}

/** Accepts the Ed25519 key as PEM (SPKI), raw 32 bytes, hex or base64. */
function verify_ed25519_signature(string $rawBody, string $signatureBase64, string $publicKey): bool {
	if (!function_exists('sodium_crypto_sign_verify_detached')) return false;
	$signature = base64_decode($signatureBase64, true);
	if ($signature === false || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) return false;
	$raw = ed25519_raw_key($publicKey);
	if ($raw === null) return false;
	return sodium_crypto_sign_verify_detached($signature, $rawBody, $raw);
}

function ed25519_raw_key(string $key): ?string {
	$key = trim($key);
	if (str_contains($key, 'BEGIN PUBLIC KEY')) {
		$der = base64_decode(preg_replace('/-----[^-]+-----|\s+/', '', $key), true);
		if ($der === false || strlen($der) < 32) return null;
		return substr($der, -32);
	}
	if (strlen($key) === 32) return $key;
	if (preg_match('/^[0-9a-f]{64}$/i', $key)) return hex2bin($key);
	$decoded = base64_decode($key, true);
	if ($decoded !== false && strlen($decoded) === 32) return $decoded;
	return null;
}

/** True when the payload's timestamp (if any) is within the replay window. */
function webhook_timestamp_ok(array $payload, int $now = 0): bool {
	$ts = $payload['timestamp'] ?? null;
	if (!is_string($ts) || $ts === '') return true;
	$t = strtotime($ts);
	if ($t === false) return false;
	$now = $now ?: time();
	return abs($now - $t) <= WEBHOOK_TIMESTAMP_WINDOW;
}

/**
 * Pulls location id, contact id and event type from any of the shapes
 * HighLevel sends: app webhooks ({type, locationId, id}) or workflow webhook
 * actions ({contact_id, location: {id}, ...} with optional customData).
 */
function extract_webhook_target(array $p): array {
	$type = $p['type'] ?? $p['event'] ?? ($p['customData']['event'] ?? null);
	$locationId = $p['locationId'] ?? $p['location_id'] ?? ($p['location']['id'] ?? null) ?? ($p['customData']['locationId'] ?? null);
	$contactId = null;
	if (isset($p['type']) && is_string($p['type']) && str_starts_with($p['type'], 'Contact') && isset($p['id'])) {
		$contactId = $p['id'];
	}
	$contactId = $contactId ?? $p['contactId'] ?? $p['contact_id'] ?? ($p['contact']['id'] ?? null) ?? ($p['customData']['contactId'] ?? null);
	if ($contactId === null && isset($p['id']) && (isset($p['first_name']) || isset($p['firstName']) || isset($p['email']))) {
		$contactId = $p['id'];
	}
	return [
		'type' => is_string($type) ? mb_substr($type, 0, 60) : null,
		'locationId' => is_string($locationId) ? $locationId : null,
		'contactId' => is_string($contactId) ? $contactId : null,
		'webhookId' => isset($p['webhookId']) && is_string($p['webhookId']) ? mb_substr($p['webhookId'], 0, 120) : null,
	];
}
