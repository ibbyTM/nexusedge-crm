<?php
/**
 * Runs an automation button against one contact and records the outcome.
 */

require_once __DIR__ . '/ghl.php';

const BUTTON_ICONS = ['zap', 'send', 'mail', 'message-square', 'phone', 'calendar', 'tag', 'sparkles', 'rocket', 'bell', 'flag', 'user-check', 'refresh-cw', 'star'];

/** Replaces {{contact.firstName}} style placeholders. Unknown keys become empty strings. */
function render_template(string $template, array $vars): string {
	return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/', function ($m) use ($vars) {
		$parts = explode('.', $m[1]);
		$value = $vars;
		foreach ($parts as $part) {
			if (is_array($value) && array_key_exists($part, $value)) {
				$value = $value[$part];
			} else {
				return '';
			}
		}
		if (is_array($value)) return json_encode($value);
		if (is_bool($value)) return $value ? 'true' : 'false';
		return (string)($value ?? '');
	}, $template);
}

/** Validates and normalises a button payload from the admin UI. Returns [row, error]. */
function normalize_button_input(array $body): array {
	$label = str_field($body, 'label', 120);
	if ($label === '') return [null, 'A label is required.'];
	$mechanism = str_field($body, 'mechanism', 20);
	if (!in_array($mechanism, ['workflow', 'webhook', 'tag'], true)) return [null, 'Mechanism must be workflow, webhook or tag.'];
	$workflowId = str_field($body, 'workflowId', 64);
	$webhookUrl = str_field($body, 'webhookUrl', 2000);
	$tagName = str_field($body, 'tagName', 120);
	if ($mechanism === 'workflow' && $workflowId === '') return [null, 'Pick a workflow.'];
	if ($mechanism === 'webhook') {
		if (!filter_var($webhookUrl, FILTER_VALIDATE_URL) || !str_starts_with($webhookUrl, 'https://')) return [null, 'The webhook URL must start with https://.'];
	}
	if ($mechanism === 'tag' && $tagName === '') return [null, 'Enter the tag to add.'];
	$icon = str_field($body, 'icon', 40);
	if (!in_array($icon, BUTTON_ICONS, true)) $icon = 'zap';
	$minRole = str_field($body, 'minRole', 10);
	if (!in_array($minRole, ['admin', 'member'], true)) $minRole = 'member';
	$locationId = str_field($body, 'locationId', 64);
	$template = isset($body['payloadTemplate']) && is_string($body['payloadTemplate']) ? mb_substr($body['payloadTemplate'], 0, 8000) : '';
	if ($mechanism === 'webhook' && $template !== '') {
		$probe = render_template($template, ['contact' => [], 'location' => [], 'user' => [], 'now' => '']);
		if (json_decode($probe, true) === null && trim($probe) !== '') return [null, 'The payload template must be valid JSON once placeholders are filled.'];
	}
	return [[
		'location_id' => $locationId === '' ? null : $locationId,
		'label' => $label,
		'description' => str_field($body, 'description', 400) ?: null,
		'icon' => $icon,
		'mechanism' => $mechanism,
		'workflow_id' => $mechanism === 'workflow' ? $workflowId : null,
		'webhook_url' => $mechanism === 'webhook' ? $webhookUrl : null,
		'tag_name' => $mechanism === 'tag' ? $tagName : null,
		'payload_template' => $mechanism === 'webhook' ? ($template ?: null) : null,
		'min_role' => $minRole,
		'confirm_text' => str_field($body, 'confirmText', 300) ?: null,
		'sort_order' => int_field($body, 'sortOrder', 0, -1000, 1000),
		'enabled' => !array_key_exists('enabled', $body) || !empty($body['enabled']),
	], null];
}

/**
 * Executes $button for $contact on behalf of $user. Always records a run.
 * Returns the run summary for the UI.
 */
function run_button_for_contact(array $button, array $contact, array $user): array {
	$status = 'failed';
	$code = null;
	$detail = null;
	$locationId = $contact['locationId'];
	try {
		switch ($button['mechanism']) {
			case 'workflow':
				ghl_add_to_workflow($locationId, $contact['id'], $button['workflow_id']);
				$status = 'success';
				$code = 200;
				$detail = 'Added to workflow';
				break;
			case 'tag':
				ghl_add_tags($locationId, $contact['id'], [$button['tag_name']]);
				$status = 'success';
				$code = 200;
				$detail = 'Tag added: ' . $button['tag_name'];
				break;
			case 'webhook':
				$vars = [
					'contact' => $contact,
					'location' => ['id' => $locationId],
					'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']],
					'now' => now_iso(),
				];
				$payload = null;
				if (!empty($button['payload_template'])) {
					$payload = json_decode(render_template($button['payload_template'], $vars), true);
				}
				if (!is_array($payload)) {
					$payload = [
						'event' => 'nexusedge_crm.automation',
						'button' => $button['label'],
						'contact_id' => $contact['id'],
						'location_id' => $locationId,
						'email' => $contact['email'],
						'phone' => $contact['phone'],
						'first_name' => $contact['firstName'],
						'last_name' => $contact['lastName'],
						'triggered_by' => $user['email'],
						'triggered_at' => now_iso(),
					];
				}
				$res = post_json_to_url($button['webhook_url'], $payload);
				$code = $res['status'];
				if ($res['ok']) {
					$status = 'success';
					$detail = 'Webhook accepted';
				} else {
					$detail = $res['body'] !== '' ? $res['body'] : 'Webhook request failed';
				}
				break;
		}
	} catch (GhlException $e) {
		$code = $e->status;
		$detail = $e->getMessage();
	} catch (Throwable $e) {
		error_log('automation run failed: ' . $e->getMessage());
		$detail = 'Unexpected error while running the automation.';
	}

	$runId = insert_run([
		'button_id' => $button['id'],
		'button_label' => $button['label'],
		'mechanism' => $button['mechanism'],
		'location_id' => $locationId,
		'contact_id' => $contact['id'],
		'contact_name' => $contact['name'] ?: trim(($contact['firstName'] ?? '') . ' ' . ($contact['lastName'] ?? '')),
		'user_id' => $user['id'],
		'user_name' => $user['name'],
		'status' => $status,
		'response_code' => $code,
		'detail' => $detail === null ? null : mb_substr($detail, 0, 2000),
	]);
	return ['runId' => $runId, 'contactId' => $contact['id'], 'status' => $status, 'responseCode' => $code, 'detail' => $detail];
}
