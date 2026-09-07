<?php
require_once __DIR__ . '/../../lib/bootstrap.php';
cors_preflight_and_headers('POST');
require_method('POST');

const LOGIN_RATE_LIMIT_DIR = __DIR__ . '/../../.rate-limit/login';
const LOGIN_RATE_LIMIT_MAX = 8;
const LOGIN_RATE_LIMIT_WINDOW = 900; // 15 minutes

function check_login_rate_limit(string $ip): bool {
	if (!is_dir(LOGIN_RATE_LIMIT_DIR)) { @mkdir(LOGIN_RATE_LIMIT_DIR, 0700, true); }
	$file = LOGIN_RATE_LIMIT_DIR . '/' . md5($ip) . '.json';
	$now = time();
	$hits = [];
	if (file_exists($file)) { $hits = json_decode(file_get_contents($file), true) ?: []; }
	$hits = array_values(array_filter($hits, fn($t) => $now - $t < LOGIN_RATE_LIMIT_WINDOW));
	if (count($hits) >= LOGIN_RATE_LIMIT_MAX) { return false; }
	$hits[] = $now;
	file_put_contents($file, json_encode($hits));
	return true;
}

$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!check_login_rate_limit($ip)) {
	send_json(['error' => 'Too many attempts. Try again in 15 minutes.'], 429);
}

$body = read_json_body();
$email = mb_strtolower(str_field($body, 'email', 255));
$password = isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
if ($email === '' || $password === '') {
	send_json(['error' => 'Email and password are required.'], 400);
}

$user = get_user_by_email($email);

// First run: create the admin from config while the users table is empty.
if (!$user && count_users() === 0 && defined('BOOTSTRAP_ADMIN_EMAIL') && BOOTSTRAP_ADMIN_EMAIL !== ''
	&& hash_equals(mb_strtolower(BOOTSTRAP_ADMIN_EMAIL), $email)
	&& defined('BOOTSTRAP_ADMIN_PASSWORD') && BOOTSTRAP_ADMIN_PASSWORD !== '' && !str_starts_with(BOOTSTRAP_ADMIN_PASSWORD, 'REPLACE')
	&& hash_equals(BOOTSTRAP_ADMIN_PASSWORD, $password)) {
	$user = insert_user($email, defined('BOOTSTRAP_ADMIN_NAME') && BOOTSTRAP_ADMIN_NAME !== '' ? BOOTSTRAP_ADMIN_NAME : 'Admin', $password, 'admin');
}

if (!$user || !password_verify($password, $user['password_hash'])) {
	send_json(['error' => 'Incorrect email or password'], 401);
}

touch_user_login($user['id']);
create_session_cookie($user['id'], SESSION_SECRET);
send_json(['success' => true, 'user' => public_user($user)]);
