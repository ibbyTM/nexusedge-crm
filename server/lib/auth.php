<?php
/**
 * Login sessions: an HMAC-signed HttpOnly cookie (same shape as the site's
 * admin cookie) carrying the user id and an expiry. No session table; a user
 * is signed out by cookie expiry, by deleting the user, or by rotating
 * SESSION_SECRET.
 */

const USER_COOKIE_NAME = 'ne_crm_session';
const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function cookie_is_secure(): bool {
	$https = $_SERVER['HTTPS'] ?? '';
	return $https !== '' && $https !== 'off';
}

function create_session_cookie(string $userId, string $secret): void {
	$exp = time() + USER_SESSION_MAX_AGE;
	$payload = rtrim(strtr(base64_encode(json_encode(['uid' => $userId, 'exp' => $exp])), '+/', '-_'), '=');
	$signature = hash_hmac('sha256', $payload, $secret);
	setcookie(USER_COOKIE_NAME, $payload . '.' . $signature, [
		'expires' => $exp,
		'path' => '/',
		'secure' => cookie_is_secure(),
		'httponly' => true,
		'samesite' => 'Lax',
	]);
}

function clear_session_cookie(): void {
	setcookie(USER_COOKIE_NAME, '', [
		'expires' => time() - 3600,
		'path' => '/',
		'secure' => cookie_is_secure(),
		'httponly' => true,
		'samesite' => 'Lax',
	]);
}

/** Returns the user id encoded in a valid, unexpired cookie value, else null. */
function session_user_id_from_cookie(?string $value, string $secret): ?string {
	if (!$value || strpos($value, '.') === false) return null;
	[$payload, $signature] = explode('.', $value, 2);
	$expected = hash_hmac('sha256', $payload, $secret);
	if (!hash_equals($expected, $signature)) return null;
	$decoded = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
	if (!is_array($decoded) || !isset($decoded['exp'], $decoded['uid'])) return null;
	if ((int)$decoded['exp'] <= time()) return null;
	return is_string($decoded['uid']) ? $decoded['uid'] : null;
}

/** The logged-in user row, or null. */
function current_user(): ?array {
	static $user = false;
	if ($user !== false) return $user;
	$user = null;
	if (!defined('SESSION_SECRET') || !SESSION_SECRET) return null;
	$uid = session_user_id_from_cookie($_COOKIE[USER_COOKIE_NAME] ?? null, SESSION_SECRET);
	if ($uid === null) return null;
	$row = get_user_by_id($uid);
	if ($row) $user = $row;
	return $user;
}

function require_user(): array {
	$user = current_user();
	if (!$user) send_json(['error' => 'Unauthorized'], 401);
	return $user;
}

function require_admin(): array {
	$user = require_user();
	if ($user['role'] !== 'admin') send_json(['error' => 'Admin access required'], 403);
	return $user;
}

/** True when $user may use something gated at $minRole. */
function role_allows(string $userRole, string $minRole): bool {
	$rank = ['member' => 1, 'admin' => 2];
	return ($rank[$userRole] ?? 0) >= ($rank[$minRole] ?? 99);
}

function public_user(array $row): array {
	return [
		'id' => $row['id'],
		'email' => $row['email'],
		'name' => $row['name'],
		'role' => $row['role'],
		'createdAt' => $row['created_at'],
		'lastLoginAt' => $row['last_login_at'],
	];
}
