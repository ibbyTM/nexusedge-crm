<?php
/**
 * Mirror sync: pulls sub-accounts, their metadata and contacts into MySQL.
 * Every step is bounded so it can run inside one HTTP request on shared
 * hosting; callers loop until a step reports done. The CLI cron script does
 * exactly that.
 */

require_once __DIR__ . '/ghl.php';

const SYNC_CONTACT_PAGE = 100;

/** Refreshes the list of sub-accounts. Returns the count. */
function sync_locations(): int {
	$skip = 0;
	$seen = 0;
	while (true) {
		$res = ghl_search_locations($skip, 100);
		$locations = $res['locations'] ?? [];
		foreach ($locations as $loc) {
			if (empty($loc['id'])) continue;
			upsert_location($loc);
			$seen++;
		}
		if (count($locations) < 100) break;
		$skip += 100;
		if ($skip > 5000) break;
	}
	return $seen;
}

/** Tags, custom fields, users and workflows for one sub-account. */
function sync_location_meta(string $locationId): array {
	$out = [];
	$state = get_sync_state($locationId, 'meta');
	$state['status'] = 'running';
	$state['last_started_at'] = now_iso();
	$state['last_error'] = null;
	save_sync_state($state);
	try {
		$tags = ghl_get_location_tags($locationId)['tags'] ?? [];
		replace_location_tags($locationId, $tags);
		$out['tags'] = count($tags);

		$fields = ghl_get_custom_fields($locationId)['customFields'] ?? [];
		replace_custom_fields($locationId, $fields);
		$out['customFields'] = count($fields);

		try {
			$users = ghl_get_location_users($locationId)['users'] ?? [];
			replace_location_users($locationId, $users);
			$out['users'] = count($users);
		} catch (GhlException $e) {
			// users.readonly may not be granted; not fatal for the CRM.
			$out['users'] = 'skipped: ' . $e->getMessage();
		}

		$workflows = ghl_list_workflows($locationId);
		replace_workflows($locationId, $workflows);
		$out['workflows'] = count($workflows);

		$state['status'] = 'done';
		$state['items_synced'] = (int)$out['tags'] + (int)$out['customFields'] + (int)$out['workflows'];
		$state['last_finished_at'] = now_iso();
		save_sync_state($state);
	} catch (Throwable $e) {
		$state['status'] = 'error';
		$state['last_error'] = $e->getMessage();
		$state['last_finished_at'] = now_iso();
		save_sync_state($state);
		throw $e;
	}
	return $out;
}

/**
 * Pulls up to $maxPages pages of contacts, resuming from the stored cursor.
 * Returns ['done' => bool, 'synced' => int, 'total' => int].
 * A finished pass resets the cursor so the next call starts a fresh full pass.
 */
function sync_contacts_step(string $locationId, int $maxPages = 5, bool $restart = false): array {
	$state = get_sync_state($locationId, 'contacts');
	if ($restart || $state['status'] === 'done' || $state['status'] === 'idle') {
		$state['cursor_id'] = null;
		$state['cursor_value'] = null;
		$state['items_synced'] = 0;
		$state['last_started_at'] = now_iso();
	}
	$state['status'] = 'running';
	$state['last_error'] = null;
	save_sync_state($state);

	$synced = 0;
	$done = false;
	try {
		for ($i = 0; $i < $maxPages; $i++) {
			$res = ghl_list_contacts($locationId, $state['cursor_id'], $state['cursor_value'], SYNC_CONTACT_PAGE);
			$contacts = $res['contacts'] ?? [];
			foreach ($contacts as $c) {
				if (empty($c['id'])) continue;
				upsert_contact_from_api($c, $locationId);
				$synced++;
			}
			$state['items_synced'] += count($contacts);
			$meta = $res['meta'] ?? [];
			$nextId = $meta['startAfterId'] ?? null;
			$nextValue = $meta['startAfter'] ?? null;
			if (count($contacts) < SYNC_CONTACT_PAGE || $nextId === null || $nextId === $state['cursor_id']) {
				$done = true;
				break;
			}
			$state['cursor_id'] = (string)$nextId;
			$state['cursor_value'] = $nextValue === null ? null : (string)$nextValue;
			save_sync_state($state);
		}
		if ($done) {
			$state['status'] = 'done';
			$state['last_finished_at'] = now_iso();
			$state['cursor_id'] = null;
			$state['cursor_value'] = null;
		}
		save_sync_state($state);
	} catch (Throwable $e) {
		$state['status'] = 'error';
		$state['last_error'] = $e->getMessage();
		$state['last_finished_at'] = now_iso();
		save_sync_state($state);
		throw $e;
	}
	return ['done' => $done, 'synced' => $synced, 'total' => (int)$state['items_synced']];
}

/** Re-fetches one contact from the API and mirrors it. Returns the mirrored contact or null when deleted. */
function refresh_contact(string $locationId, string $contactId): ?array {
	try {
		$c = ghl_get_contact($locationId, $contactId);
	} catch (GhlException $e) {
		if ($e->status === 404) {
			mark_contact_deleted($contactId);
			return null;
		}
		throw $e;
	}
	if (empty($c['id'])) return null;
	upsert_contact_from_api($c, $c['locationId'] ?? $locationId);
	return get_contact($c['id']);
}

/** Live notes + tasks for a contact, cached into the mirror. */
function refresh_contact_activity(string $locationId, string $contactId): array {
	$notes = ghl_get_notes($locationId, $contactId);
	replace_contact_notes($contactId, $locationId, $notes);
	$tasks = [];
	try {
		$tasks = ghl_get_tasks($locationId, $contactId);
		replace_contact_tasks($contactId, $locationId, $tasks);
	} catch (GhlException $e) {
		// Tasks are optional; keep whatever is cached.
		$tasks = get_contact_tasks($contactId);
	}
	return ['notes' => get_contact_notes($contactId), 'tasks' => get_contact_tasks($contactId)];
}
