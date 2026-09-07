<?php
require_once __DIR__ . '/../../lib/bootstrap.php';
cors_preflight_and_headers('POST');
require_method('POST');
clear_session_cookie();
send_json(['success' => true]);
