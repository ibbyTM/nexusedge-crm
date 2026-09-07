-- NexusEdge CRM schema. Run once in phpMyAdmin (or `mysql < schema.sql`).
-- Conventions match the marketing site: ISO-8601 UTC strings for timestamps,
-- UUIDv4 for rows we create, HighLevel's own ids for mirrored records.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','member') NOT NULL DEFAULT 'member',
  created_at VARCHAR(32) NOT NULL,
  last_login_at VARCHAR(32) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  country VARCHAR(8) NULL,
  postal_code VARCHAR(32) NULL,
  website VARCHAR(255) NULL,
  timezone VARCHAR(64) NULL,
  company_id VARCHAR(64) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  synced_at VARCHAR(32) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Short-lived sub-account tokens exchanged from the agency token
-- (POST /oauth/locationToken). Cached so the exchange happens once a day.
CREATE TABLE IF NOT EXISTS ghl_location_tokens (
  location_id VARCHAR(64) NOT NULL,
  access_token TEXT NOT NULL,
  expires_at INT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  first_name VARCHAR(200) NULL,
  last_name VARCHAR(200) NULL,
  name VARCHAR(400) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  company_name VARCHAR(255) NULL,
  address1 VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  country VARCHAR(8) NULL,
  postal_code VARCHAR(32) NULL,
  website VARCHAR(255) NULL,
  timezone VARCHAR(64) NULL,
  source VARCHAR(255) NULL,
  assigned_to VARCHAR(64) NULL,
  dnd TINYINT(1) NOT NULL DEFAULT 0,
  dnd_settings JSON NULL,
  tags JSON NOT NULL,
  custom_fields JSON NOT NULL,
  date_added VARCHAR(32) NULL,
  date_updated VARCHAR(32) NULL,
  last_activity VARCHAR(32) NULL,
  synced_at VARCHAR(32) NOT NULL,
  deleted_at VARCHAR(32) NULL,
  PRIMARY KEY (id),
  KEY ix_contacts_location_updated (location_id, date_updated),
  KEY ix_contacts_location_name (location_id, last_name, first_name),
  KEY ix_contacts_email (email),
  KEY ix_contacts_phone (phone),
  KEY ix_contacts_added (location_id, date_added)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  tag VARCHAR(120) NOT NULL,
  PRIMARY KEY (contact_id, tag),
  KEY ix_contact_tags_tag (location_id, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_tags (
  location_id VARCHAR(64) NOT NULL,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (location_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_fields (
  id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  field_key VARCHAR(200) NULL,
  data_type VARCHAR(40) NULL,
  placeholder VARCHAR(255) NULL,
  position INT NOT NULL DEFAULT 0,
  picklist_options JSON NULL,
  model VARCHAR(20) NOT NULL DEFAULT 'contact',
  PRIMARY KEY (id),
  KEY ix_custom_fields_location (location_id, model, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_users (
  id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  role VARCHAR(40) NULL,
  PRIMARY KEY (id, location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NULL,
  body TEXT NOT NULL,
  date_added VARCHAR(32) NULL,
  PRIMARY KEY (id),
  KEY ix_notes_contact (contact_id, date_added)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  title VARCHAR(400) NULL,
  body TEXT NULL,
  assigned_to VARCHAR(64) NULL,
  due_date VARCHAR(32) NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_tasks_contact (contact_id, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(40) NULL,
  version INT NULL,
  created_at VARCHAR(32) NULL,
  updated_at VARCHAR(32) NULL,
  synced_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_workflows_location (location_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Buttons the team sees under "Run automation". Each one points at a
-- workflow built in HighLevel, an inbound webhook URL, or a tag.
CREATE TABLE IF NOT EXISTS automation_buttons (
  id CHAR(36) NOT NULL,
  location_id VARCHAR(64) NULL,
  label VARCHAR(120) NOT NULL,
  description VARCHAR(400) NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'zap',
  mechanism ENUM('workflow','webhook','tag') NOT NULL,
  workflow_id VARCHAR(64) NULL,
  webhook_url TEXT NULL,
  tag_name VARCHAR(120) NULL,
  payload_template TEXT NULL,
  min_role ENUM('admin','member') NOT NULL DEFAULT 'member',
  confirm_text VARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_buttons_location (location_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_runs (
  id CHAR(36) NOT NULL,
  button_id CHAR(36) NULL,
  button_label VARCHAR(120) NOT NULL,
  mechanism ENUM('workflow','webhook','tag') NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NULL,
  contact_name VARCHAR(400) NULL,
  user_id CHAR(36) NOT NULL,
  user_name VARCHAR(200) NOT NULL,
  status ENUM('success','failed') NOT NULL,
  response_code INT NULL,
  detail TEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_runs_contact (contact_id, created_at),
  KEY ix_runs_location (location_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_state (
  location_id VARCHAR(64) NOT NULL,
  resource VARCHAR(40) NOT NULL,
  cursor_id VARCHAR(64) NULL,
  cursor_value VARCHAR(64) NULL,
  status ENUM('idle','running','done','error') NOT NULL DEFAULT 'idle',
  items_synced INT NOT NULL DEFAULT 0,
  last_started_at VARCHAR(32) NULL,
  last_finished_at VARCHAR(32) NULL,
  last_error TEXT NULL,
  PRIMARY KEY (location_id, resource)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id CHAR(36) NOT NULL,
  webhook_id VARCHAR(120) NULL,
  event_type VARCHAR(60) NULL,
  source ENUM('app','workflow') NOT NULL,
  location_id VARCHAR(64) NULL,
  contact_id VARCHAR(64) NULL,
  received_at VARCHAR(32) NOT NULL,
  processed TINYINT(1) NOT NULL DEFAULT 0,
  error TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhook_id (webhook_id),
  KEY ix_webhook_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sliding 10 second windows for the HighLevel burst limit (100 requests).
CREATE TABLE IF NOT EXISTS api_rate (
  rate_key VARCHAR(64) NOT NULL,
  window_start INT NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  PRIMARY KEY (rate_key, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
