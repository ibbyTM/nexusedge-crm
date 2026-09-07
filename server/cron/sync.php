<?php
/**
 * Full sync from the command line. Add to cPanel > Cron Jobs, for example
 * every night at 02:00:
 *   0 2 * * * /usr/local/bin/php /home/USER/public_html/cron/sync.php >/dev/null 2>&1
 *
 * Or every 15 minutes for near-live mirroring when webhooks are not set up.
 * A lock file prevents overlapping runs.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/sync.php';

$lockDir = __DIR__ . '/../.locks';
if (!is_dir($lockDir)) @mkdir($lockDir, 0700, true);
$lock = fopen($lockDir . '/sync.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { fwrite(STDERR, "sync already running\n"); exit(0); }

$started = microtime(true);
$log = function (string $msg) use ($started) { echo sprintf('[%6.1fs] %s', microtime(true) - $started, $msg), PHP_EOL; };

try {
	$log('locations: ' . sync_locations());
	foreach (list_locations(true) as $loc) {
		$id = $loc['id'];
		try {
			$meta = sync_location_meta($id);
			$log("$id meta: " . json_encode($meta));
		} catch (Throwable $e) {
			$log("$id meta FAILED: " . $e->getMessage());
		}
		$restart = true;
		$total = 0;
		while (true) {
			try {
				$r = sync_contacts_step($id, 10, $restart);
			} catch (Throwable $e) {
				$log("$id contacts FAILED: " . $e->getMessage());
				break;
			}
			$restart = false;
			$total += $r['synced'];
			if ($r['done']) break;
		}
		$log("$id contacts: $total");
	}
} finally {
	flock($lock, LOCK_UN);
	fclose($lock);
}
$log('done');
