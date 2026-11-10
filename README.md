# twCIN

![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline--First-5A0FC8)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

An internal IT workbench, equipment movement, and loan tracking Progressive Web App (PWA) built for fast, low-friction daily operations.

## What It Does

**twCIN** gives internal IT teams a single workspace to track equipment under IT custody (`Equipamentos`), record exits and loans to other departments (`Movimentações`), monitor operational metrics (`Gráficos`), and access frequent actions (`Início`)—without forcing an external helpdesk ticketing portal on end users.

## Why It Is Useful

- **Quick overview (`Início`):** Unified search, quick shortcuts, equipment currently in maintenance/evaluation, and active loans in one place.
- **IT Equipment Custody (`Equipamentos`):** Distinguishes own IT equipment, stock items, and items received from other departments or third parties (including origin, received from, reason, condition status, and movement history).
- **Movements, History & Printable PDFs (`Movimentações`):** Automatic or manual date/time capture, searchable destination sector selector with inline confirmed sector creation, required install location, integrated sector/location configuration, full movement history and audit logs, one-click return registration, and clean A4 print/PDF receipts and reports.
- **Visual Analytics (`Gráficos`):** Interactive indicators for equipment condition, ownership distribution, 14-day movement timeline, top sectors, top locations, most-moved equipment, and technician activity.
- **Full editability & immutable audit logs:** Every equipment, movement, sector, location, and user update is editable and recorded in an append-only `audit_logs` trail with before/after JSON snapshots.
- **Offline-first PWA synchronization:** Installs on desktop and mobile devices, caches operational data in `IndexedDB` (Dexie), queues offline changes with `client_uuid` idempotency, and syncs multi-user updates with `version`-based conflict detection.
- **Security by design:** Password hashing via `scrypt` + `timingSafeEqual`, `HttpOnly` JWT session cookies, `token_version` session revocation, forced password change on first login (optional per user), Zod input validation, `@fastify/helmet`, and route-level `@fastify/rate-limit`.
- **Customizable white-label branding, theme & device install (`Configurações`):** Manage personal account security (`Minha Conta`), customize system title, organization name, and PNG/JPEG/WebP logo (`Organização`), switch between **System default**, **Light**, and **Dark** themes (`Aparência`), and install the PWA on demand without pop-ups (`Aplicativo`).

## Getting Started

### Prerequisites

- **Node.js `24.x`** or newer (uses built-in `node:sqlite`, no C++ build tools required)
- **npm `10+`**

### Installation

```bash
git clone https://github.com/WiltonGabriel/twCIN.git
cd twCIN

npm --prefix backend install
npm --prefix frontend install
```

### Configuration (Optional)

By default, the backend stores its SQLite database at `backend/data/twcin.db` and generates a persistent local signing key in `backend/data/.jwt_secret`. For custom settings or production deployment, copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

### Running Locally

Start both the Fastify API (`http://localhost:3333`) and Vite PWA frontend (`http://localhost:5173`):

```bash
npm run dev
```

On Windows PowerShell (when script execution policy restricts `.ps1` shims), run `npm.cmd run dev` or `node scripts/dev.mjs`.

### First-Time Setup

When starting with a fresh database (no users yet), open `http://localhost:5173` in your browser to create the first IT user account and optional organization name directly on the setup screen.

### Testing and Building

```bash
# Typecheck backend
npm --prefix backend run typecheck

# Run automated backend test suite
npm test

# Build backend and production PWA bundle
npm run build
```

> **Note for LAN / Mobile PWA deployment:** Browsers allow Service Worker caching and PWA installation on `localhost` or over **HTTPS**. When deploying to an internal server, serve `frontend/dist` and proxy `/api` to the backend behind an HTTPS reverse proxy (e.g., Caddy or Nginx).

## Project Structure

```text
twCIN/
├── backend/              # Fastify REST API, SQLite schema, auth, sync & tests
├── frontend/             # React 19 + TypeScript + Tailwind + Vite PWA
├── docs/                 # Supplementary documentation
├── scripts/dev.mjs       # Local multi-process runner
├── CONTRIBUTING.md       # Contribution guidelines
└── LICENSE               # MIT License
```

## Where to Get Help

- **API overview:** [docs/API.md](docs/API.md)
- **Contribution rules:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Bug reports & feature requests:** Open an issue in the repository's GitHub Issues tab.

## Maintainers and Contributing

Maintained by **Wilton Pereira** and **Thales**.

Contributions are welcome—see [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request. Released under the [MIT License](LICENSE).
