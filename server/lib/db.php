<?php
/**
 * PDO singleton plus every query the endpoints need. Endpoints never write
 * SQL inline; they call a named helper here (same rule as the site).
 */

function get_db(): PDO {
	static $pdo = null;
	if ($pdo !== null) return $pdo;

	try {
		$dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
		if (defined('DB_PORT') && DB_PORT) $dsn .= ';port=' . (int)DB_PORT;
		$pdo = new PDO(
			$dsn,
			DB_USER,
			DB_PASS,
			[
				PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
				PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
				PDO::ATTR_EMULATE_PREPARES => false,
			]
		);
	} catch (PDOException $e) {
		error_log('DB connection failed: ' . $e->getMessage());
		send_json(['error' => 'Database connection failed.'], 500);
	}
	return $pdo;
}

function db_json_decode($value, $default = []) {
	if ($value === null || $value === '') return $default;
	$decoded = json_decode((string)$value, true);
	return $decoded === null ? $default : $decoded;
}

/* ---------- users ---------- */

function count_users(): int {
	return (int)get_db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

function get_user_by_id(string $id): ?array {
	$st = get_db()->prepare('SELECT * FROM users WHERE id = ?');
	$st->execute([$id]);
	return $st->fetch() ?: null;
}

function get_user_by_email(string $email): ?array {
	$st = get_db()->prepare('SELECT * FROM users WHERE email = ?');
	$st->execute([mb_strtolower($email)]);
	return $st->fetch() ?: null;
}

function list_users(): array {
	return get_db()->query('SELECT * FROM users ORDER BY created_at ASC')->fetchAll();
}

function insert_user(string $email, string $name, string $password, string $role): array {
	$row = [
		'id' => generate_uuid4(),
		'email' => mb_strtolower($email),
		'name' => $name,
		'password_hash' => password_hash($password, PASSWORD_DEFAULT),
		'role' => $role,
		'created_at' => now_iso(),
		'last_login_at' => null,
	];
	get_db()->prepare('INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
		->execute([$row['id'], $row['email'], $row['name'], $row['password_hash'], $row['role'], $row['created_at']]);
	return $row;
}

function touch_user_login(string $id): void {
	get_db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now_iso(), $id]);
}

function update_user(string $id, array $fields): void {
	$sets = [];
	$params = [];
	foreach (['name', 'role', 'password_hash'] as $col) {
		if (array_key_exists($col, $fields)) {
			$sets[] = "$col = ?";
			$params[] = $fields[$col];
		}
	}
	if (!$sets) return;
	$params[] = $id;
	get_db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
}

function delete_user(string $id): void {
	get_db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
}

/* ---------- locations ---------- */

function upsert_location(array $loc): void {
	$sql = 'INSERT INTO locations (id, name, phone, email, address, city, state, country, postal_code, website, timezone, synced_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), email = VALUES(email), address = VALUES(address),
		city = VALUES(city), state = VALUES(state), country = VALUES(country), postal_code = VALUES(postal_code),
		website = VALUES(website), timezone = VALUES(timezone), synced_at = VALUES(synced_at)';
	get_db()->prepare($sql)->execute([
		$loc['id'], $loc['name'] ?? $loc['id'], $loc['phone'] ?? null, $loc['email'] ?? null, $loc['address'] ?? null,
		$loc['city'] ?? null, $loc['state'] ?? null, $loc['country'] ?? null, $loc['postalCode'] ?? null,
		$loc['website'] ?? null, $loc['timezone'] ?? null, now_iso(),
	]);
}

function list_locations(bool $enabledOnly): array {
	$sql = 'SELECT l.*, (SELECT COUNT(*) FROM contacts c WHERE c.location_id = l.id AND c.deleted_at IS NULL) AS contact_count
		FROM locations l' . ($enabledOnly ? ' WHERE l.enabled = 1' : '') . ' ORDER BY l.name ASC';
	return get_db()->query($sql)->fetchAll();
}

function get_location(string $id): ?array {
	$st = get_db()->prepare('SELECT * FROM locations WHERE id = ?');
	$st->execute([$id]);
	return $st->fetch() ?: null;
}

function set_location_enabled(string $id, bool $enabled): void {
	get_db()->prepare('UPDATE locations SET enabled = ? WHERE id = ?')->execute([$enabled ? 1 : 0, $id]);
}

/* ---------- location metadata ---------- */

function replace_location_tags(string $locationId, array $tags): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM location_tags WHERE location_id = ?')->execute([$locationId]);
		$st = $pdo->prepare('INSERT INTO location_tags (location_id, id, name) VALUES (?, ?, ?)');
		foreach ($tags as $tag) {
			if (empty($tag['id']) || empty($tag['name'])) continue;
			$st->execute([$locationId, $tag['id'], mb_substr($tag['name'], 0, 120)]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function replace_custom_fields(string $locationId, array $fields): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM custom_fields WHERE location_id = ?')->execute([$locationId]);
		$st = $pdo->prepare('INSERT INTO custom_fields (id, location_id, name, field_key, data_type, placeholder, position, picklist_options, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
		foreach ($fields as $f) {
			if (empty($f['id'])) continue;
			$st->execute([
				$f['id'], $locationId, mb_substr($f['name'] ?? $f['id'], 0, 200), $f['fieldKey'] ?? null, $f['dataType'] ?? null,
				$f['placeholder'] ?? null, (int)($f['position'] ?? 0),
				isset($f['picklistOptions']) ? json_encode($f['picklistOptions']) : null, $f['model'] ?? 'contact',
			]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function replace_location_users(string $locationId, array $users): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM location_users WHERE location_id = ?')->execute([$locationId]);
		$st = $pdo->prepare('INSERT INTO location_users (id, location_id, name, email, role) VALUES (?, ?, ?, ?, ?)');
		foreach ($users as $u) {
			if (empty($u['id'])) continue;
			$role = is_array($u['roles'] ?? null) ? ($u['roles']['role'] ?? null) : null;
			$st->execute([$u['id'], $locationId, $u['name'] ?? trim(($u['firstName'] ?? '') . ' ' . ($u['lastName'] ?? '')), $u['email'] ?? null, $role]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function replace_workflows(string $locationId, array $workflows): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM workflows WHERE location_id = ?')->execute([$locationId]);
		$st = $pdo->prepare('INSERT INTO workflows (id, location_id, name, status, version, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
		$now = now_iso();
		foreach ($workflows as $w) {
			if (empty($w['id'])) continue;
			$st->execute([$w['id'], $locationId, mb_substr($w['name'] ?? $w['id'], 0, 255), $w['status'] ?? null, isset($w['version']) ? (int)$w['version'] : null, iso_or_null($w['createdAt'] ?? null), iso_or_null($w['updatedAt'] ?? null), $now]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function get_location_meta(string $locationId): array {
	$pdo = get_db();
	$tags = $pdo->prepare('SELECT id, name FROM location_tags WHERE location_id = ? ORDER BY name');
	$tags->execute([$locationId]);
	$fields = $pdo->prepare('SELECT * FROM custom_fields WHERE location_id = ? AND model IN ("contact", "all") ORDER BY position, name');
	$fields->execute([$locationId]);
	$users = $pdo->prepare('SELECT id, name, email, role FROM location_users WHERE location_id = ? ORDER BY name');
	$users->execute([$locationId]);
	$workflows = $pdo->prepare('SELECT id, name, status, version, updated_at FROM workflows WHERE location_id = ? ORDER BY name');
	$workflows->execute([$locationId]);
	return [
		'tags' => $tags->fetchAll(),
		'customFields' => array_map(fn($f) => [
			'id' => $f['id'], 'name' => $f['name'], 'fieldKey' => $f['field_key'], 'dataType' => $f['data_type'],
			'placeholder' => $f['placeholder'], 'position' => (int)$f['position'],
			'picklistOptions' => db_json_decode($f['picklist_options'], null),
		], $fields->fetchAll()),
		'users' => $users->fetchAll(),
		'workflows' => array_map(fn($w) => [
			'id' => $w['id'], 'name' => $w['name'], 'status' => $w['status'], 'version' => $w['version'] === null ? null : (int)$w['version'], 'updatedAt' => $w['updated_at'],
		], $workflows->fetchAll()),
	];
}

function get_workflow(string $id): ?array {
	$st = get_db()->prepare('SELECT * FROM workflows WHERE id = ?');
	$st->execute([$id]);
	return $st->fetch() ?: null;
}

/* ---------- contacts ---------- */

/** Maps a HighLevel contact object (API or webhook shape) to a mirror row and writes it. */
function upsert_contact_from_api(array $c, string $locationId): void {
	$tags = [];
	foreach ((array)($c['tags'] ?? []) as $t) {
		if (is_string($t) && trim($t) !== '') $tags[] = mb_substr(trim($t), 0, 120);
	}
	$tags = array_values(array_unique($tags));
	$customFields = [];
	foreach ((array)($c['customFields'] ?? $c['customField'] ?? []) as $f) {
		if (is_array($f) && isset($f['id'])) $customFields[] = ['id' => $f['id'], 'value' => $f['value'] ?? null];
	}
	$firstName = $c['firstName'] ?? null;
	$lastName = $c['lastName'] ?? null;
	$name = $c['name'] ?? $c['contactName'] ?? trim(($firstName ?? '') . ' ' . ($lastName ?? ''));

	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$sql = 'INSERT INTO contacts (id, location_id, first_name, last_name, name, email, phone, company_name, address1, city, state, country,
			postal_code, website, timezone, source, assigned_to, dnd, dnd_settings, tags, custom_fields, date_added, date_updated, last_activity, synced_at, deleted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
			ON DUPLICATE KEY UPDATE location_id = VALUES(location_id), first_name = VALUES(first_name), last_name = VALUES(last_name), name = VALUES(name),
			email = VALUES(email), phone = VALUES(phone), company_name = VALUES(company_name), address1 = VALUES(address1), city = VALUES(city),
			state = VALUES(state), country = VALUES(country), postal_code = VALUES(postal_code), website = VALUES(website), timezone = VALUES(timezone),
			source = VALUES(source), assigned_to = VALUES(assigned_to), dnd = VALUES(dnd), dnd_settings = VALUES(dnd_settings), tags = VALUES(tags),
			custom_fields = VALUES(custom_fields), date_added = VALUES(date_added), date_updated = VALUES(date_updated), last_activity = VALUES(last_activity),
			synced_at = VALUES(synced_at), deleted_at = NULL';
		$pdo->prepare($sql)->execute([
			$c['id'], $locationId, $firstName, $lastName, $name !== '' ? $name : null, $c['email'] ?? null, $c['phone'] ?? null,
			$c['companyName'] ?? null, $c['address1'] ?? null, $c['city'] ?? null, $c['state'] ?? null, $c['country'] ?? null,
			$c['postalCode'] ?? null, $c['website'] ?? null, $c['timezone'] ?? null, $c['source'] ?? null, $c['assignedTo'] ?? null,
			!empty($c['dnd']) ? 1 : 0, isset($c['dndSettings']) ? json_encode($c['dndSettings']) : null,
			json_encode($tags), json_encode($customFields),
			iso_or_null($c['dateAdded'] ?? null), iso_or_null($c['dateUpdated'] ?? null) ?? now_iso(), iso_or_null($c['lastActivity'] ?? null), now_iso(),
		]);
		$pdo->prepare('DELETE FROM contact_tags WHERE contact_id = ?')->execute([$c['id']]);
		$st = $pdo->prepare('INSERT IGNORE INTO contact_tags (contact_id, location_id, tag) VALUES (?, ?, ?)');
		foreach ($tags as $tag) $st->execute([$c['id'], $locationId, $tag]);
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function mark_contact_deleted(string $id): void {
	$pdo = get_db();
	$pdo->prepare('UPDATE contacts SET deleted_at = ? WHERE id = ?')->execute([now_iso(), $id]);
	$pdo->prepare('DELETE FROM contact_tags WHERE contact_id = ?')->execute([$id]);
}

function get_contact(string $id): ?array {
	$st = get_db()->prepare('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL');
	$st->execute([$id]);
	$row = $st->fetch();
	return $row ? contact_row_to_json($row) : null;
}

function get_contacts_by_ids(array $ids): array {
	if (!$ids) return [];
	$in = implode(',', array_fill(0, count($ids), '?'));
	$st = get_db()->prepare("SELECT * FROM contacts WHERE deleted_at IS NULL AND id IN ($in)");
	$st->execute(array_values($ids));
	return array_map('contact_row_to_json', $st->fetchAll());
}

function contact_row_to_json(array $r): array {
	return [
		'id' => $r['id'],
		'locationId' => $r['location_id'],
		'firstName' => $r['first_name'],
		'lastName' => $r['last_name'],
		'name' => $r['name'],
		'email' => $r['email'],
		'phone' => $r['phone'],
		'companyName' => $r['company_name'],
		'address1' => $r['address1'],
		'city' => $r['city'],
		'state' => $r['state'],
		'country' => $r['country'],
		'postalCode' => $r['postal_code'],
		'website' => $r['website'],
		'timezone' => $r['timezone'],
		'source' => $r['source'],
		'assignedTo' => $r['assigned_to'],
		'dnd' => (bool)$r['dnd'],
		'dndSettings' => db_json_decode($r['dnd_settings'], null),
		'tags' => db_json_decode($r['tags'], []),
		'customFields' => db_json_decode($r['custom_fields'], []),
		'dateAdded' => $r['date_added'],
		'dateUpdated' => $r['date_updated'],
		'lastActivity' => $r['last_activity'],
		'syncedAt' => $r['synced_at'],
	];
}

/**
 * Paged, filtered contact list from the mirror.
 * $opts: q, tag, assignedTo, sort (updated|added|name), dir (asc|desc), page, pageSize.
 */
function search_contacts(string $locationId, array $opts): array {
	$where = ['c.location_id = ?', 'c.deleted_at IS NULL'];
	$params = [$locationId];

	$q = trim($opts['q'] ?? '');
	if ($q !== '') {
		$like = '%' . $q . '%';
		$where[] = '(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company_name LIKE ?)';
		array_push($params, $like, $like, $like, $like);
	}
	if (!empty($opts['tag'])) {
		$where[] = 'EXISTS (SELECT 1 FROM contact_tags t WHERE t.contact_id = c.id AND t.tag = ?)';
		$params[] = $opts['tag'];
	}
	if (!empty($opts['assignedTo'])) {
		$where[] = 'c.assigned_to = ?';
		$params[] = $opts['assignedTo'];
	}
	$sortCol = ['updated' => 'c.date_updated', 'added' => 'c.date_added', 'name' => 'c.last_name'][$opts['sort'] ?? 'updated'] ?? 'c.date_updated';
	$dir = ($opts['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
	$pageSize = max(10, min(200, (int)($opts['pageSize'] ?? 50)));
	$page = max(1, (int)($opts['page'] ?? 1));
	$offset = ($page - 1) * $pageSize;

	$pdo = get_db();
	$whereSql = implode(' AND ', $where);
	$count = $pdo->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereSql");
	$count->execute($params);
	$total = (int)$count->fetchColumn();

	$st = $pdo->prepare("SELECT c.* FROM contacts c WHERE $whereSql ORDER BY $sortCol $dir, c.id ASC LIMIT $pageSize OFFSET $offset");
	$st->execute($params);
	return ['contacts' => array_map('contact_row_to_json', $st->fetchAll()), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
}

function location_tag_counts(string $locationId): array {
	$st = get_db()->prepare('SELECT tag, COUNT(*) AS n FROM contact_tags WHERE location_id = ? GROUP BY tag ORDER BY n DESC, tag ASC LIMIT 300');
	$st->execute([$locationId]);
	return $st->fetchAll();
}

/* ---------- notes & tasks (mirror of the live fetch) ---------- */

function replace_contact_notes(string $contactId, string $locationId, array $notes): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM notes WHERE contact_id = ?')->execute([$contactId]);
		$st = $pdo->prepare('INSERT INTO notes (id, contact_id, location_id, user_id, body, date_added) VALUES (?, ?, ?, ?, ?, ?)');
		foreach ($notes as $n) {
			if (empty($n['id'])) continue;
			$st->execute([$n['id'], $contactId, $locationId, $n['userId'] ?? null, (string)($n['body'] ?? ''), iso_or_null($n['dateAdded'] ?? null)]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function replace_contact_tasks(string $contactId, string $locationId, array $tasks): void {
	$pdo = get_db();
	$pdo->beginTransaction();
	try {
		$pdo->prepare('DELETE FROM tasks WHERE contact_id = ?')->execute([$contactId]);
		$st = $pdo->prepare('INSERT INTO tasks (id, contact_id, location_id, title, body, assigned_to, due_date, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
		foreach ($tasks as $t) {
			if (empty($t['id'])) continue;
			$st->execute([$t['id'], $contactId, $locationId, $t['title'] ?? null, $t['body'] ?? null, $t['assignedTo'] ?? null, iso_or_null($t['dueDate'] ?? null), !empty($t['completed']) ? 1 : 0]);
		}
		$pdo->commit();
	} catch (Throwable $e) {
		$pdo->rollBack();
		throw $e;
	}
}

function get_contact_notes(string $contactId): array {
	$st = get_db()->prepare('SELECT id, user_id, body, date_added FROM notes WHERE contact_id = ? ORDER BY date_added DESC');
	$st->execute([$contactId]);
	return array_map(fn($n) => ['id' => $n['id'], 'userId' => $n['user_id'], 'body' => $n['body'], 'dateAdded' => $n['date_added']], $st->fetchAll());
}

function get_contact_tasks(string $contactId): array {
	$st = get_db()->prepare('SELECT id, title, body, assigned_to, due_date, completed FROM tasks WHERE contact_id = ? ORDER BY completed ASC, due_date ASC');
	$st->execute([$contactId]);
	return array_map(fn($t) => ['id' => $t['id'], 'title' => $t['title'], 'body' => $t['body'], 'assignedTo' => $t['assigned_to'], 'dueDate' => $t['due_date'], 'completed' => (bool)$t['completed']], $st->fetchAll());
}

/* ---------- automations ---------- */

function button_row_to_json(array $b): array {
	return [
		'id' => $b['id'],
		'locationId' => $b['location_id'],
		'label' => $b['label'],
		'description' => $b['description'],
		'icon' => $b['icon'],
		'mechanism' => $b['mechanism'],
		'workflowId' => $b['workflow_id'],
		'webhookUrl' => $b['webhook_url'],
		'tagName' => $b['tag_name'],
		'payloadTemplate' => $b['payload_template'],
		'minRole' => $b['min_role'],
		'confirmText' => $b['confirm_text'],
		'sortOrder' => (int)$b['sort_order'],
		'enabled' => (bool)$b['enabled'],
		'createdAt' => $b['created_at'],
		'updatedAt' => $b['updated_at'],
	];
}

/** Buttons visible for a location: location-specific ones plus global (NULL location) ones. */
function list_buttons(?string $locationId, bool $includeDisabled): array {
	$sql = 'SELECT * FROM automation_buttons WHERE 1=1';
	$params = [];
	if ($locationId !== null) {
		$sql .= ' AND (location_id IS NULL OR location_id = ?)';
		$params[] = $locationId;
	}
	if (!$includeDisabled) $sql .= ' AND enabled = 1';
	$sql .= ' ORDER BY sort_order ASC, label ASC';
	$st = get_db()->prepare($sql);
	$st->execute($params);
	return array_map('button_row_to_json', $st->fetchAll());
}

function get_button(string $id): ?array {
	$st = get_db()->prepare('SELECT * FROM automation_buttons WHERE id = ?');
	$st->execute([$id]);
	return $st->fetch() ?: null;
}

function insert_button(array $b): string {
	$id = generate_uuid4();
	$now = now_iso();
	get_db()->prepare('INSERT INTO automation_buttons (id, location_id, label, description, icon, mechanism, workflow_id, webhook_url, tag_name, payload_template, min_role, confirm_text, sort_order, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
		->execute([$id, $b['location_id'], $b['label'], $b['description'], $b['icon'], $b['mechanism'], $b['workflow_id'], $b['webhook_url'], $b['tag_name'], $b['payload_template'], $b['min_role'], $b['confirm_text'], $b['sort_order'], $b['enabled'] ? 1 : 0, $now, $now]);
	return $id;
}

function update_button(string $id, array $b): void {
	get_db()->prepare('UPDATE automation_buttons SET location_id = ?, label = ?, description = ?, icon = ?, mechanism = ?, workflow_id = ?, webhook_url = ?, tag_name = ?, payload_template = ?, min_role = ?, confirm_text = ?, sort_order = ?, enabled = ?, updated_at = ? WHERE id = ?')
		->execute([$b['location_id'], $b['label'], $b['description'], $b['icon'], $b['mechanism'], $b['workflow_id'], $b['webhook_url'], $b['tag_name'], $b['payload_template'], $b['min_role'], $b['confirm_text'], $b['sort_order'], $b['enabled'] ? 1 : 0, now_iso(), $id]);
}

function delete_button(string $id): void {
	get_db()->prepare('DELETE FROM automation_buttons WHERE id = ?')->execute([$id]);
}

function insert_run(array $r): string {
	$id = generate_uuid4();
	get_db()->prepare('INSERT INTO automation_runs (id, button_id, button_label, mechanism, location_id, contact_id, contact_name, user_id, user_name, status, response_code, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
		->execute([$id, $r['button_id'], $r['button_label'], $r['mechanism'], $r['location_id'], $r['contact_id'], $r['contact_name'], $r['user_id'], $r['user_name'], $r['status'], $r['response_code'], $r['detail'], now_iso()]);
	return $id;
}

function list_runs(array $opts): array {
	$where = ['1=1'];
	$params = [];
	if (!empty($opts['contactId'])) { $where[] = 'contact_id = ?'; $params[] = $opts['contactId']; }
	if (!empty($opts['locationId'])) { $where[] = 'location_id = ?'; $params[] = $opts['locationId']; }
	if (!empty($opts['status'])) { $where[] = 'status = ?'; $params[] = $opts['status']; }
	$pageSize = max(10, min(200, (int)($opts['pageSize'] ?? 50)));
	$page = max(1, (int)($opts['page'] ?? 1));
	$offset = ($page - 1) * $pageSize;
	$whereSql = implode(' AND ', $where);
	$pdo = get_db();
	$count = $pdo->prepare("SELECT COUNT(*) FROM automation_runs WHERE $whereSql");
	$count->execute($params);
	$st = $pdo->prepare("SELECT * FROM automation_runs WHERE $whereSql ORDER BY created_at DESC LIMIT $pageSize OFFSET $offset");
	$st->execute($params);
	return [
		'runs' => array_map(fn($r) => [
			'id' => $r['id'], 'buttonId' => $r['button_id'], 'buttonLabel' => $r['button_label'], 'mechanism' => $r['mechanism'],
			'locationId' => $r['location_id'], 'contactId' => $r['contact_id'], 'contactName' => $r['contact_name'],
			'userId' => $r['user_id'], 'userName' => $r['user_name'], 'status' => $r['status'],
			'responseCode' => $r['response_code'] === null ? null : (int)$r['response_code'], 'detail' => $r['detail'], 'createdAt' => $r['created_at'],
		], $st->fetchAll()),
		'total' => (int)$count->fetchColumn(), 'page' => $page, 'pageSize' => $pageSize,
	];
}

/* ---------- sync state ---------- */

function get_sync_state(string $locationId, string $resource): array {
	$st = get_db()->prepare('SELECT * FROM sync_state WHERE location_id = ? AND resource = ?');
	$st->execute([$locationId, $resource]);
	$row = $st->fetch();
	return $row ?: ['location_id' => $locationId, 'resource' => $resource, 'cursor_id' => null, 'cursor_value' => null, 'status' => 'idle', 'items_synced' => 0, 'last_started_at' => null, 'last_finished_at' => null, 'last_error' => null];
}

function save_sync_state(array $s): void {
	get_db()->prepare('INSERT INTO sync_state (location_id, resource, cursor_id, cursor_value, status, items_synced, last_started_at, last_finished_at, last_error)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE cursor_id = VALUES(cursor_id), cursor_value = VALUES(cursor_value), status = VALUES(status), items_synced = VALUES(items_synced),
		last_started_at = VALUES(last_started_at), last_finished_at = VALUES(last_finished_at), last_error = VALUES(last_error)')
		->execute([$s['location_id'], $s['resource'], $s['cursor_id'], $s['cursor_value'], $s['status'], (int)$s['items_synced'], $s['last_started_at'], $s['last_finished_at'], $s['last_error']]);
}

function list_sync_states(): array {
	return get_db()->query('SELECT * FROM sync_state ORDER BY location_id, resource')->fetchAll();
}

/* ---------- webhooks ---------- */

/** Records the event; returns false when the webhookId was already seen. */
function record_webhook_event(array $e): bool {
	try {
		get_db()->prepare('INSERT INTO webhook_events (id, webhook_id, event_type, source, location_id, contact_id, received_at, processed, error) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)')
			->execute([$e['id'], $e['webhook_id'], $e['event_type'], $e['source'], $e['location_id'], $e['contact_id'], now_iso()]);
		return true;
	} catch (PDOException $ex) {
		if ($ex->getCode() === '23000') return false;
		throw $ex;
	}
}

function finish_webhook_event(string $id, ?string $error): void {
	get_db()->prepare('UPDATE webhook_events SET processed = ?, error = ? WHERE id = ?')->execute([$error === null ? 1 : 0, $error, $id]);
}

function recent_webhook_events(int $limit = 50): array {
	$limit = max(1, min(200, $limit));
	return get_db()->query("SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT $limit")->fetchAll();
}

/* ---------- rate limiting ---------- */

/** Increments the current 10 second window for $key and returns the new count. */
function rate_hit(string $key): int {
	$window = intdiv(time(), 10) * 10;
	$pdo = get_db();
	$pdo->prepare('INSERT INTO api_rate (rate_key, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1')->execute([$key, $window]);
	$st = $pdo->prepare('SELECT hits FROM api_rate WHERE rate_key = ? AND window_start = ?');
	$st->execute([$key, $window]);
	if (mt_rand(1, 50) === 1) {
		$pdo->prepare('DELETE FROM api_rate WHERE window_start < ?')->execute([$window - 60]);
	}
	return (int)$st->fetchColumn();
}
