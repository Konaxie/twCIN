# API Reference

All routes except `/api/health`, `/api/settings/public`, `/api/auth/status`, `/api/auth/setup`, and `/api/auth/login` require a valid `HttpOnly` session cookie (`twcin_session`).

## Health & Organization Settings

- `GET /api/health` — Returns `{ ok: true }`.
- `GET /api/settings/public` — Returns `{ settings: { app_name, org_name, logo_data_url } }`.
- `PATCH /api/settings` — Updates organization branding (`app_name`, `org_name`, PNG/JPEG/WebP `logo_data_url`).

## Authentication

- `GET /api/auth/status` — Checks whether first-run setup is required (`{ needs_setup: boolean }`).
- `POST /api/auth/setup` — Creates the initial user when the database has zero users (rate-limited).
- `POST /api/auth/login` — Authenticates and sets the `HttpOnly` session cookie (strictly rate-limited).
- `POST /api/auth/change-password` — Updates the signed-in user's password, rotates `token_version`, and issues a fresh cookie.
- `POST /api/auth/logout` — Clears the session cookie.
- `GET /api/auth/me` — Returns the current authenticated user.

## Equipments (IT Custody & Inventory)

- `GET /api/catalogs/equipments` — Lists equipments (`?includeInactive=true`).
- `GET /api/catalogs/equipments/:id` — Returns equipment metadata and linked movement history.
- `POST /api/catalogs/equipments` — Creates an equipment record (`ownership_type`, `condition_status`, optional `patrimony`, `origin`, `received_from`, `reason`, `notes`).
- `PATCH /api/catalogs/equipments/:id` — Edits equipment fields and custody status with `expected_version` concurrency validation.

## Equipment Movements & Loans

- `GET /api/movements` — Lists movements (`?includeFinished=true&status=...&sector=...&search=...`).
- `GET /api/movements/:id` — Retrieves a movement by ID.
- `POST /api/movements` — Registers a movement or loan (`install_location` required, optional `patrimony` and `received_by`) and generates a sequential `document_code` (`MOV-XXXX`).
- `PATCH /api/movements/:id` — Edits a movement record.
- `POST /api/movements/:id/return` — Marks a loan as returned with automatic timestamp and receiving technician.

## Sectors, Locations & Autocomplete

- `GET /api/catalogs/suggestions` — Combined autocomplete suggestions from catalogs and previous entries.
- `GET /api/catalogs/sectors`, `POST /api/catalogs/sectors`, `PATCH /api/catalogs/sectors/:id`
- `GET /api/catalogs/locations`, `POST /api/catalogs/locations`, `PATCH /api/catalogs/locations/:id`

## Users & Audit Logs

- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` — Equal-access IT user management (`must_change_password`, active/inactive).
- `POST /api/users/:id/revoke-sessions` — Increments `token_version` to invalidate active sessions.
- `GET /api/audit` — Queries immutable audit entries (`?entity=...&entity_id=...&action=...&user_id=...&limit=...`).

## Offline Synchronization

- `GET /api/sync/snapshot` — Full state snapshot for local `IndexedDB` cache hydration.
- `POST /api/sync` — Processes chronological offline `sync_queue` operations (`equipment.*`, `movement.*`, `sector.create`) with `client_uuid` idempotency and `version` conflict detection.
