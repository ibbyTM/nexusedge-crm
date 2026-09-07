<?php
require_once __DIR__ . '/../../lib/bootstrap.php';
cors_preflight_and_headers('GET');
require_method('GET');
$user = require_user();
send_json(['user' => public_user($user)]);
