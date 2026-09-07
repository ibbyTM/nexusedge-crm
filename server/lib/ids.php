<?php

function generate_uuid4(): string {
	$bytes = random_bytes(16);
	$bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
	$bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
	return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

/** ISO-8601 UTC with milliseconds, identical to JavaScript's toISOString(). */
function now_iso(): string {
	$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
	return $now->format('Y-m-d\TH:i:s.v\Z');
}

function iso_or_null($value): ?string {
	if (!is_string($value) || $value === '') return null;
	try {
		$dt = new DateTimeImmutable($value);
		return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
	} catch (Exception $e) {
		return null;
	}
}
