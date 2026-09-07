<?php
if (!defined('CONTACT_WRITABLE_FIELDS')) {
	define('CONTACT_WRITABLE_FIELDS', ['firstName', 'lastName', 'name', 'email', 'phone', 'companyName', 'address1', 'city', 'state', 'postalCode', 'country', 'website', 'timezone', 'source', 'assignedTo', 'dateOfBirth']);
}
if (!function_exists('pick_contact_fields')) {
	/** Whitelists and trims the contact fields a client may send. */
	function pick_contact_fields(array $body): array {
		$out = [];
		foreach (CONTACT_WRITABLE_FIELDS as $key) {
			if (!array_key_exists($key, $body)) continue;
			$value = $body[$key];
			if ($value === null) { $out[$key] = null; continue; }
			if (!is_string($value)) continue;
			$out[$key] = mb_substr(trim($value), 0, 500);
		}
		if (array_key_exists('dnd', $body)) $out['dnd'] = (bool)$body['dnd'];
		if (isset($body['tags']) && is_array($body['tags'])) $out['tags'] = string_list_field($body, 'tags', 200);
		if (isset($body['customFields']) && is_array($body['customFields'])) {
			$fields = [];
			foreach ($body['customFields'] as $f) {
				if (!is_array($f) || !isset($f['id']) || !is_string($f['id'])) continue;
				$fields[] = ['id' => $f['id'], 'field_value' => $f['value'] ?? ''];
			}
			$out['customFields'] = $fields;
		}
		return $out;
	}
}
