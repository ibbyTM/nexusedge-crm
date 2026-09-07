<?php
/**
 * GET    /api/team                 list users (admin)
 * POST   /api/team  {email, name, password, role}
 * PUT    /api/team  {id, name?, role?, password?}
 * DELETE /api/team  {id}
 */
require_once __DIR__ . '/../lib/bootstrap.php';
cors_preflight_and_headers('GET, POST, PUT, DELETE');
require_method('GET', 'POST', 'PUT', 'DELETE');
$me = require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	send_json(['users' => array_map('public_user', list_users())]);
}
$body = read_json_body();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$email = mb_strtolower(str_field($body, 'email', 255));
	$name = str_field($body, 'name', 200);
	$password = isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
	$role = str_field($body, 'role', 10) === 'admin' ? 'admin' : 'member';
	if (!filter_var($email, FILTER_VALIDATE_EMAIL)) send_json(['error' => 'Enter a valid email.'], 400);
	if ($name === '') send_json(['error' => 'A name is required.'], 400);
	if (mb_strlen($password) < 10) send_json(['error' => 'Passwords need at least 10 characters.'], 400);
	if (get_user_by_email($email)) send_json(['error' => 'That email already has an account.'], 409);
	$user = insert_user($email, $name, $password, $role);
	send_json(['user' => public_user($user)], 201);
}

$id = str_field($body, 'id', 36);
$target = $id !== '' ? get_user_by_id($id) : null;
if (!$target) send_json(['error' => 'User not found'], 404);

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
	if ($target['id'] === $me['id']) send_json(['error' => 'You cannot delete your own account.'], 400);
	delete_user($id);
	send_json(['success' => true]);
}

$fields = [];
$name = str_field($body, 'name', 200);
if ($name !== '') $fields['name'] = $name;
if (isset($body['role'])) {
	$role = $body['role'] === 'admin' ? 'admin' : 'member';
	if ($target['id'] === $me['id'] && $role !== 'admin') send_json(['error' => 'You cannot remove your own admin role.'], 400);
	$fields['role'] = $role;
}
if (isset($body['password']) && is_string($body['password']) && $body['password'] !== '') {
	if (mb_strlen($body['password']) < 10) send_json(['error' => 'Passwords need at least 10 characters.'], 400);
	$fields['password_hash'] = password_hash($body['password'], PASSWORD_DEFAULT);
}
update_user($id, $fields);
send_json(['user' => public_user(get_user_by_id($id))]);
