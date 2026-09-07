<?php
/**
 * Thin HighLevel API v2 client: curl + JSON, bearer token per location,
 * per-resource Version header, burst-limit pacing and 429 retry.
 *
 * Every function returns the decoded JSON body. Failures throw GhlException
 * carrying the HTTP status and HighLevel's message so endpoints can relay it.
 */

class GhlException extends RuntimeException {
	public int $status;
	public string $body;
	public function __construct(string $message, int $status, string $body = '') {
		parent::__construct($message, $status);
		$this->status = $status;
		$this->body = $body;
	}
}

const GHL_VERSION_DEFAULT = '2021-07-28';
const GHL_VERSION_CONVERSATIONS = '2021-04-15';
const GHL_BURST_LIMIT = 100; // requests per 10 seconds per location
const GHL_BURST_SOFT = 90;   // start pausing here to leave headroom

function ghl_base(): string {
	return rtrim(defined('GHL_API_BASE') ? GHL_API_BASE : 'https://services.leadconnectorhq.com', '/');
}

/** Token for a location: an explicit override if configured, else the agency token. */
function ghl_token_for_location(?string $locationId): string {
	if ($locationId !== null && defined('GHL_LOCATION_TOKENS') && is_array(GHL_LOCATION_TOKENS) && !empty(GHL_LOCATION_TOKENS[$locationId])) {
		return GHL_LOCATION_TOKENS[$locationId];
	}
	if (!defined('GHL_AGENCY_TOKEN') || !GHL_AGENCY_TOKEN || str_starts_with(GHL_AGENCY_TOKEN, 'pit-REPLACE')) {
		throw new GhlException('HighLevel token is not configured (GHL_AGENCY_TOKEN in config.php).', 500);
	}
	return GHL_AGENCY_TOKEN;
}

/** Blocks briefly when the current 10 second window is nearly full. */
function ghl_pace(string $locationKey): void {
	$hits = rate_hit('ghl:' . $locationKey);
	if ($hits >= GHL_BURST_SOFT) {
		$remaining = 10 - (time() % 10);
		usleep(min(10, $remaining + 1) * 1000000);
	}
}

/**
 * @param array $opts  query (array), body (array|null), locationId (string|null), version (string), raw (bool: skip JSON body)
 */
function ghl_request(string $method, string $path, array $opts = []): array {
	$locationId = $opts['locationId'] ?? null;
	$token = $opts['token'] ?? ghl_token_for_location($locationId);
	$version = $opts['version'] ?? GHL_VERSION_DEFAULT;
	$url = ghl_base() . '/' . ltrim($path, '/');
	if (!empty($opts['query'])) {
		$url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($opts['query']);
	}

	$attempt = 0;
	while (true) {
		$attempt++;
		ghl_pace($locationId ?? 'agency');

		$ch = curl_init($url);
		$headers = [
			'Authorization: Bearer ' . $token,
			'Version: ' . $version,
			'Accept: application/json',
		];
		$payload = null;
		if (array_key_exists('body', $opts) && $opts['body'] !== null) {
			if (!empty($opts['form'])) {
				$payload = http_build_query($opts['body']);
				$headers[] = 'Content-Type: application/x-www-form-urlencoded';
			} else {
				$payload = json_encode($opts['body']);
				$headers[] = 'Content-Type: application/json';
			}
		}
		curl_setopt_array($ch, [
			CURLOPT_CUSTOMREQUEST => $method,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_HTTPHEADER => $headers,
			CURLOPT_TIMEOUT => 30,
			CURLOPT_CONNECTTIMEOUT => 10,
			CURLOPT_HEADER => true,
		]);
		if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

		$response = curl_exec($ch);
		if ($response === false) {
			$err = curl_error($ch);
			curl_close($ch);
			if ($attempt < 3) { usleep(500000 * $attempt); continue; }
			throw new GhlException('Could not reach HighLevel: ' . $err, 502);
		}
		$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
		$headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
		curl_close($ch);
		$rawHeaders = substr($response, 0, $headerSize);
		$body = substr($response, $headerSize);

		if ($status === 429 && $attempt < 4) {
			$retryAfter = 2;
			if (preg_match('/^retry-after:\s*(\d+)/mi', $rawHeaders, $m)) $retryAfter = max(1, min(15, (int)$m[1]));
			sleep($retryAfter);
			continue;
		}
		if (($status === 502 || $status === 503 || $status === 504) && $attempt < 3) {
			sleep($attempt);
			continue;
		}

		$decoded = json_decode($body, true);
		if ($status >= 200 && $status < 300) {
			return is_array($decoded) ? $decoded : [];
		}
		$message = 'HighLevel returned ' . $status;
		if (is_array($decoded)) {
			$m = $decoded['message'] ?? $decoded['error'] ?? null;
			if (is_array($m)) $m = implode('; ', array_map('strval', $m));
			if (is_string($m) && $m !== '') $message = $m;
		}
		$message .= ' [' . $method . ' ' . parse_url($url, PHP_URL_PATH) . ']';
		if ($status === 401) $message .= ' The token was rejected. Check GHL_AGENCY_TOKEN in config.php and that it has not been rotated or expired.';
		if ($status === 403) $message .= ' Forbidden usually means a missing scope on the Private Integration, or a token created inside a sub-account being used for an agency-wide call.';
		throw new GhlException($message, $status, mb_substr($body, 0, 2000));
	}
}

/* ---------- locations ---------- */

function ghl_search_locations(int $skip = 0, int $limit = 100): array {
	$query = ['skip' => $skip, 'limit' => $limit];
	if (defined('GHL_COMPANY_ID') && GHL_COMPANY_ID !== '') $query['companyId'] = GHL_COMPANY_ID;
	return ghl_request('GET', '/locations/search', ['query' => $query]);
}

function ghl_get_location(string $locationId): array {
	return ghl_request('GET', "/locations/$locationId", ['locationId' => $locationId]);
}

function ghl_get_location_tags(string $locationId): array {
	return ghl_request('GET', "/locations/$locationId/tags", ['locationId' => $locationId]);
}

function ghl_get_custom_fields(string $locationId): array {
	return ghl_request('GET', "/locations/$locationId/customFields", ['locationId' => $locationId, 'query' => ['model' => 'contact']]);
}

function ghl_get_location_users(string $locationId): array {
	return ghl_request('GET', '/users/', ['locationId' => $locationId, 'query' => ['locationId' => $locationId]]);
}

/* ---------- contacts ---------- */

function ghl_list_contacts(string $locationId, ?string $startAfterId, ?string $startAfter, int $limit = 100): array {
	$query = ['locationId' => $locationId, 'limit' => $limit];
	if ($startAfterId !== null) $query['startAfterId'] = $startAfterId;
	if ($startAfter !== null) $query['startAfter'] = $startAfter;
	return ghl_request('GET', '/contacts/', ['locationId' => $locationId, 'query' => $query]);
}

function ghl_get_contact(string $locationId, string $contactId): array {
	$res = ghl_request('GET', "/contacts/$contactId", ['locationId' => $locationId]);
	return $res['contact'] ?? $res;
}

function ghl_create_contact(string $locationId, array $fields): array {
	$fields['locationId'] = $locationId;
	$res = ghl_request('POST', '/contacts/', ['locationId' => $locationId, 'body' => $fields]);
	return $res['contact'] ?? $res;
}

function ghl_update_contact(string $locationId, string $contactId, array $fields): array {
	$res = ghl_request('PUT', "/contacts/$contactId", ['locationId' => $locationId, 'body' => $fields]);
	return $res['contact'] ?? $res;
}

function ghl_delete_contact(string $locationId, string $contactId): void {
	ghl_request('DELETE', "/contacts/$contactId", ['locationId' => $locationId]);
}

function ghl_add_tags(string $locationId, string $contactId, array $tags): array {
	return ghl_request('POST', "/contacts/$contactId/tags", ['locationId' => $locationId, 'body' => ['tags' => array_values($tags)]]);
}

function ghl_remove_tags(string $locationId, string $contactId, array $tags): array {
	return ghl_request('DELETE', "/contacts/$contactId/tags", ['locationId' => $locationId, 'body' => ['tags' => array_values($tags)]]);
}

function ghl_get_notes(string $locationId, string $contactId): array {
	$res = ghl_request('GET', "/contacts/$contactId/notes", ['locationId' => $locationId]);
	return $res['notes'] ?? [];
}

function ghl_create_note(string $locationId, string $contactId, string $body, ?string $userId): array {
	$payload = ['body' => $body];
	if ($userId) $payload['userId'] = $userId;
	$res = ghl_request('POST', "/contacts/$contactId/notes", ['locationId' => $locationId, 'body' => $payload]);
	return $res['note'] ?? $res;
}

function ghl_get_tasks(string $locationId, string $contactId): array {
	$res = ghl_request('GET', "/contacts/$contactId/tasks", ['locationId' => $locationId]);
	return $res['tasks'] ?? [];
}

/* ---------- workflows ---------- */

function ghl_list_workflows(string $locationId): array {
	$res = ghl_request('GET', '/workflows/', ['locationId' => $locationId, 'query' => ['locationId' => $locationId]]);
	return $res['workflows'] ?? [];
}

function ghl_add_to_workflow(string $locationId, string $contactId, string $workflowId, ?string $eventStartTime = null): array {
	$start = $eventStartTime ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:sP');
	return ghl_request('POST', "/contacts/$contactId/workflow/$workflowId", ['locationId' => $locationId, 'body' => ['eventStartTime' => $start]]);
}

function ghl_remove_from_workflow(string $locationId, string $contactId, string $workflowId): array {
	return ghl_request('DELETE', "/contacts/$contactId/workflow/$workflowId", ['locationId' => $locationId]);
}

/* ---------- generic outbound POST (inbound-webhook workflow triggers) ---------- */

function post_json_to_url(string $url, array $payload): array {
	$ch = curl_init($url);
	curl_setopt_array($ch, [
		CURLOPT_POST => true,
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
		CURLOPT_POSTFIELDS => json_encode($payload),
		CURLOPT_TIMEOUT => 20,
		CURLOPT_CONNECTTIMEOUT => 10,
	]);
	$body = curl_exec($ch);
	if ($body === false) {
		$err = curl_error($ch);
		curl_close($ch);
		return ['ok' => false, 'status' => 0, 'body' => $err];
	}
	$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
	curl_close($ch);
	return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => mb_substr((string)$body, 0, 2000)];
}
