<?php
/**
 * Router for PHP's built-in server during local development. Replicates the
 * .htaccess rules: /api/* pretty paths run the matching PHP file, everything
 * else is served from the static export in ../out with clean URLs.
 *
 *   npm run build
 *   php -S 127.0.0.1:8080 server/dev-router.php
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$root = __DIR__;
$out = realpath(__DIR__ . '/../out') ?: (__DIR__ . '/../out');

if (preg_match('#^/api/(.+?)/?$#', $uri, $m)) {
	$file = $root . '/api/' . $m[1] . '.php';
	if (is_file($file)) {
		chdir(dirname($file));
		require $file;
		return true;
	}
	http_response_code(404);
	header('Content-Type: application/json');
	echo json_encode(['error' => 'Unknown API route']);
	return true;
}

$path = $out . rawurldecode($uri);
$serve = function (string $file): bool {
	$types = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'json' => 'application/json', 'txt' => 'text/plain; charset=utf-8',
		'svg' => 'image/svg+xml', 'png' => 'image/png', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2', 'woff' => 'font/woff', 'webp' => 'image/webp', 'jpg' => 'image/jpeg', 'map' => 'application/json'];
	$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
	header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
	header('Content-Length: ' . filesize($file));
	readfile($file);
	return true;
};
if ($uri !== '/' && is_file($path)) return $serve($path);
if (is_file($path . '.html')) return $serve($path . '.html');
if (is_dir($path) && is_file(rtrim($path, '/') . '/index.html')) return $serve(rtrim($path, '/') . '/index.html');
if ($uri === '/' && is_file($out . '/index.html')) return $serve($out . '/index.html');
http_response_code(404);
if (is_file($out . '/404.html')) return $serve($out . '/404.html');
echo 'Not found';
return true;
