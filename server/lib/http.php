<?php
/**
 * Shared response helpers for every api/* endpoint. Same contract as the
 * marketing site: JSON in, JSON out, {"error": "..."} plus a status on failure.
 */

function send_json($body, int $status = 200): void {
	http_response_code($status);
	echo json_encode($body);
	exit;
}

/**
 * Sets CORS + content-type headers and handles the OPTIONS preflight.
 *
 * The CRM normally runs same-origin (static export and PHP on one host), in
 * which case no browser ever sends an Origin that needs allowing. APP_ORIGINS
 * exists for `next dev` on localhost talking to a separately served PHP tree.
 */
function cors_preflight_and_headers(string $allowedMethods, bool $json = true): void {
	if ($json) {
		header('Content-Type: application/json');
	}
	$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
	$allowed = defined('APP_ORIGINS') ? APP_ORIGINS : [];
	if ($origin !== '' && in_array($origin, $allowed, true)) {
		header('Access-Control-Allow-Origin: ' . $origin);
		header('Access-Control-Allow-Credentials: true');
		header('Vary: Origin');
	}
	header('Access-Control-Allow-Methods: ' . $allowedMethods . ', OPTIONS');
	header('Access-Control-Allow-Headers: Content-Type');

	if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
		http_response_code(204);
		exit;
	}
}

function require_method(string ...$methods): void {
	if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) {
		send_json(['error' => 'Method not allowed'], 405);
	}
}

function read_json_body(): array {
	$body = json_decode(file_get_contents('php://input'), true);
	return is_array($body) ? $body : [];
}

/** Trimmed string from an array, or '' when missing / not a string. */
function str_field(array $source, string $key, int $maxLength = 500): string {
	$value = $source[$key] ?? null;
	if (!is_string($value)) return '';
	$value = trim($value);
	return mb_substr($value, 0, $maxLength);
}

function int_field(array $source, string $key, int $default, int $min, int $max): int {
	$value = $source[$key] ?? null;
	if (is_string($value) && is_numeric($value)) $value = (int)$value;
	if (!is_int($value)) return $default;
	return max($min, min($max, $value));
}

/** Array of unique, trimmed, non-empty strings from a JSON field. */
function string_list_field(array $source, string $key, int $maxItems = 100, int $maxLength = 120): array {
	$value = $source[$key] ?? null;
	if (!is_array($value)) return [];
	$out = [];
	foreach ($value as $item) {
		if (!is_string($item)) continue;
		$item = trim($item);
		if ($item === '') continue;
		$out[mb_substr($item, 0, $maxLength)] = true;
		if (count($out) >= $maxItems) break;
	}
	return array_keys($out);
}
