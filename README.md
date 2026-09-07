# NexusEdge CRM

The NexusEdge team's own front end for HighLevel. Same design system as
nexusedge.tech, same hosting shape: a static Next.js export plus a small
PHP and MySQL backend on Bluehost. HighLevel stays the system of record;
this app is the interface the team actually works in.

## What it does

- Sub-account switcher for every location under the agency.
- Contacts: fast search and filters over a MySQL mirror, detail page with
  standard and custom fields, tags, do not disturb, notes and tasks. Every
  write goes to HighLevel first, then updates the mirror.
- Automations: admins expose workflows built in HighLevel as buttons. The
  team runs them from a contact or in bulk from the contacts table. Three
  mechanisms: add to workflow, call an inbound webhook, add a tag. Every run
  is logged with who, what, and HighLevel's reply.
- Sync: bounded sync steps that run from the UI or from cPanel cron, and a
  webhook receiver that keeps individual contacts fresh between syncs.
- Team accounts with admin and member roles.

## Layout

```
app/                Next.js 16 App Router, output: "export" (no server)
components/         UI: shell, contacts, automations, settings; ui/ is shadcn (radix-nova)
lib/                API client, app state, types, formatters
server/             PHP backend, uploaded flattened into public_html/
  lib/              bootstrap, http, db, auth, ghl (API client), sync, webhook, automations
  api/              one file per endpoint; pretty paths come from .htaccess rewrites
  cron/sync.php     full sync for cPanel cron
  schema.sql        MySQL schema, run once
  config.example.php  copy to config.php and fill in (gitignored)
  tests/run.php     unit tests (php server/tests/run.php)
  mock-ghl/         a stand-in HighLevel API for local development
  dev-router.php    router for PHP's built-in server during development
public/.htaccess    rewrites, headers, CSP
```

## HighLevel setup

1. In HighLevel go to Agency Settings, then Private Integrations, and create
   an agency level token with at least these scopes:
   `locations.readonly`, `contacts.readonly`, `contacts.write`,
   `workflows.readonly`, `locations/tags.readonly`,
   `locations/customFields.readonly`, `users.readonly`.
   Put it in `GHL_AGENCY_TOKEN`. Rotate it every 90 days as HighLevel
   recommends; only `config.php` changes.
2. Optional, for live updates: in each sub-account create a workflow whose
   triggers are Contact Created, Contact Changed and Contact Tag Added, and
   add a Webhook action that POSTs to
   `https://YOUR-HOST/api/webhooks/ghl?key=GHL_WEBHOOK_KEY`. The receiver
   only reads the contact id from the payload and re-fetches the contact, so
   the payload contents do not matter. Marketplace-app webhooks signed with
   `x-wh-signature` or `x-ghl-signature` are accepted too.
3. Build your automations as workflows in HighLevel. Workflows you want the
   team to trigger with custom data should start with the Inbound Webhook
   trigger; copy its URL into an automation button of type webhook.

## Deploying to Bluehost

The pattern is identical to the marketing site: build the static export,
upload it, and upload the PHP tree flattened next to it.

1. Create a MySQL database and user in cPanel. Open phpMyAdmin and run
   `server/schema.sql`.
2. Copy `server/config.example.php` to `server/config.php` and fill in every
   value. Generate the secrets with something like `openssl rand -hex 32`.
   Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`; the first login
   with those credentials creates the admin account.
3. Build: `npm install` then `npm run build`. The site lands in `out/`.
4. Upload the contents of `out/` to the document root of the CRM host (for
   example `public_html/crm/` or a subdomain root).
5. Upload the PHP tree into the same root, dropping the `server/` prefix:
   `server/lib/` becomes `lib/`, `server/api/` becomes `api/`,
   `server/cron/` becomes `cron/`, plus `config.php` and `schema.sql` is not
   needed on the host. Upload `public/.htaccess` to the root.
6. Sign in, open Settings, then Sync and webhooks, and press Sync everything
   now. The first pass pulls sub-accounts, tags, custom fields, users,
   workflows and contacts.
7. Add a cron job in cPanel for the nightly reconcile:

   ```
   0 2 * * * /usr/local/bin/php /home/USER/public_html/crm/cron/sync.php >/dev/null 2>&1
   ```

   Or, if the host prefers URL based cron:

   ```
   0 2 * * * wget -qO- "https://YOUR-HOST/api/sync?key=CRON_KEY&step=locations" >/dev/null
   ```

   The URL form only refreshes the sub-account list; the CLI form does the
   full sync. Both are safe to run while people use the app.

`.htaccess` blocks direct requests to `lib/`, `cron/`, `config.php` and the
rate limit folders. Confirm after upload that
`https://YOUR-HOST/config.php` returns 403.

### Rate limits

HighLevel allows 100 requests per 10 seconds and 200,000 per day per
sub-account. The client paces itself with a sliding window in MySQL and
retries on 429. A full sync of 20,000 contacts costs about 200 requests.

## Local development on Windows, the easy way

Double-click `setup.bat` in the project folder. It downloads portable PHP,
MariaDB and Node into `.local\` (no installers, no admin rights), creates the
database, writes `server\config.php`, builds the front end, starts everything
and opens http://127.0.0.1:8080. Sign in with `admin@nexusedge.test` and
`nexusedge-local`, then run the first sync from Settings.

By default it uses the built-in mock API with sample data. To work against your
real HighLevel account, run it from a Command Prompt with your agency token:

```bat
setup.bat pit-your-token-here
```

or edit `server\config.php` afterwards (`GHL_AGENCY_TOKEN` and `GHL_API_BASE`).
Later, `start.bat` brings the servers back and `stop.bat` shuts them down.
After pulling new code, run `npm run build` (or `setup.bat` again) before
`start.bat`.

## Local development

Requirements: Node 20 or newer, PHP 8.1 or newer with `pdo_mysql`, `curl`,
`openssl` and `sodium`, and a MySQL or MariaDB server.

```
# database
mysql -u root -e "CREATE DATABASE nexusedge_crm CHARACTER SET utf8mb4"
mysql -u root nexusedge_crm < server/schema.sql

# config: copy the example, point DB_* at the local database and set
#   const GHL_API_BASE = 'http://127.0.0.1:8090';   (the mock)
#   const APP_ORIGINS = ['http://localhost:3000'];  (for next dev)
cp server/config.example.php server/config.php

# a stand-in HighLevel API with two sub-accounts and 200 contacts
php -S 127.0.0.1:8090 server/mock-ghl/index.php

# the PHP API plus the built export, mirroring the Bluehost routing
npm run build
php -S 127.0.0.1:8080 server/dev-router.php
# then open http://127.0.0.1:8080

# or, for hot reload: run the PHP server as above and
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080 npm run dev
```

Checks:

```
npm run typecheck
npm run lint
npm run test:php
```

## Conventions

Everything visible follows the NexusEdge design brief: one purple hue,
Space Grotesk for headings, Inter Tight for body, Geist Mono for eyebrows and
data, tight corner radii, Lucide icons in tinted chips, no em dashes, no
stock imagery. `app/globals.css`, `components.json` and the effect
components are copied from the marketing site so the two stay in step.

PHP follows the site's conventions too: `send_json`, `{"error": "..."}`
responses, PDO with prepared statements, named query helpers in `lib/db.php`,
ISO-8601 strings for timestamps, UUIDv4 for rows the CRM creates.
