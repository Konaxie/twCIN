# Contributing to twCIN

Thank you for your interest in contributing to **twCIN**.

## Development Setup

1. Ensure **Node.js 24+** (`node:sqlite` support) and **npm** are installed.
2. Install dependencies for both packages:

```bash
npm --prefix backend install
npm --prefix frontend install
```

3. Run the development servers:

```bash
npm run dev
```

## Quality Checks

Before opening a pull request, make sure typechecking, tests, and builds pass:

```bash
npm --prefix backend run typecheck
npm test
npm run build
```

## Guidelines

- Keep all user-facing strings objective and consistent with the existing Portuguese UI.
- Never commit `.env` files, `.db` files, secrets, or institution-specific branding assets.
- Add or update automated tests in `backend/tests/` for any API or database behavior changes.
- Validate all new request payloads with Zod schemas and preserve audit logging in `audit_logs`.
