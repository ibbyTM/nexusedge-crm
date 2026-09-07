<?php
/**
 * Copy this file to config.php (same folder) and fill in the real values.
 * config.php is gitignored: it holds every secret the CRM needs.
 *
 * On Bluehost the PHP tree is uploaded flattened into public_html/, so this
 * file ends up at public_html/config.php next to lib/ and api/.
 */

// MySQL, created in cPanel > MySQL Databases. Run schema.sql once in phpMyAdmin.
const DB_HOST = 'localhost';
const DB_NAME = 'REPLACE_WITH_YOUR_DB_NAME';
const DB_USER = 'REPLACE_WITH_YOUR_DB_USER';
const DB_PASS = 'REPLACE_WITH_YOUR_DB_PASSWORD';

// Signs the login cookie. Any long random string; rotating it logs everyone out.
const SESSION_SECRET = 'REPLACE_WITH_A_LONG_RANDOM_STRING';

// First admin account. Used only while the users table is empty: the first
// successful login with these credentials creates the admin user. Remove the
// values (or leave them) afterwards; they are ignored once a user exists.
const BOOTSTRAP_ADMIN_EMAIL = 'you@nexusedge.tech';
const BOOTSTRAP_ADMIN_PASSWORD = 'REPLACE_WITH_A_STRONG_PASSWORD';
const BOOTSTRAP_ADMIN_NAME = 'Your Name';

// HighLevel Private Integration token created at the AGENCY level
// (Agency Settings > Private Integrations). Needs at least these scopes:
// locations.readonly, contacts.readonly, contacts.write, workflows.readonly,
// locations/tags.readonly, locations/customFields.readonly, users.readonly,
// oauth.write (only if you rely on the location token exchange below).
const GHL_AGENCY_TOKEN = 'pit-REPLACE_WITH_YOUR_AGENCY_TOKEN';

// Optional. Your agency (company) id, used to list sub-accounts. Leave empty to
// let the API infer it from the token.
const GHL_COMPANY_ID = '';

// Optional per-location overrides. If a sub-account needs its own
// location-level Private Integration token, map its location id to it here.
// Any location not listed uses GHL_AGENCY_TOKEN.
const GHL_LOCATION_TOKENS = [
	// 've9EPM428h8vShlRW1KT' => 'pit-location-token',
];

// Shared secret for change notifications sent from HighLevel workflows
// (Workflow action "Webhook" > POST https://<your host>/api/webhooks/ghl?key=THIS).
const GHL_WEBHOOK_KEY = 'REPLACE_WITH_A_LONG_RANDOM_STRING';

// Optional. Ed25519 public key for marketplace-app webhooks (x-ghl-signature).
// The legacy RSA key for x-wh-signature is built in (lib/webhook.php).
const GHL_ED25519_PUBLIC_KEY = '';

// Secret that lets cPanel cron (or a wget line) call /api/sync?key=THIS.
const CRON_KEY = 'REPLACE_WITH_A_LONG_RANDOM_STRING';

// Origins allowed to call the API with cookies. Leave as [] when the static
// export and the PHP files share one host (the normal Bluehost setup). Add
// 'http://localhost:3000' while running `next dev` against a local PHP server.
const APP_ORIGINS = [];

// Advanced. Leave as-is unless HighLevel changes its base URL, or you are
// running the local mock server for development.
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
