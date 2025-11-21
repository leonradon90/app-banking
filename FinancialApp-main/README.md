# Digital Banking MVP Core

A NestJS-based prototype implementing the core primitives of a digital bank: authentication/KYC, accounts, payments, ledger, audit logging, card controls, limits & anti-fraud hooks, and a push notification center.

## Features

- **Auth & KYC** – JWT authentication with simulated KYC lifecycle.
- **Accounts & Ledger** – Double-entry ledger with idempotent transfers and audit trail.
- **Payments** – P2P transfers guarded by configurable limits and anti-fraud checks.
- **Card Controls** – Freeze/unfreeze, MCC & geo limits, and Kafka fan-out.
- **Notifications** – Event-driven push center capturing transaction events.
- **Limits & Anti-Fraud** – Configurable per-transaction rules with audit records.
- **OpenAPI** – `openapi/openapi.yaml` plus in-app Swagger (`/docs`).
- **Dockerized infrastructure** – Postgres, Redis, Kafka, Zookeeper, and the API service.

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Bootstrap infrastructure**
   ```bash
   docker compose up -d postgres redis zookeeper kafka
   npm run migration:run
   ```

3. **Run the API**
   ```bash
   npm run start:dev
   ```

   Swagger UI is available at http://localhost:3000/docs.

## Environment

Copy `.env.example` to `.env` and adjust credentials if needed.

## Testing

```bash
npm test
```

## Architecture highlights

- Event-driven integrations via Kafka topics (`transactions`, `card_controls_events`).
- Audit logging for every critical action.
- Idempotency guaranteed with `Idempotency-Key` (UUID) stored in the ledger table.
- Limits service is extensible for daily/monthly aggregations.
- Notification center is ready for WebSocket/Push integrations.

## Database schema

See `src/database/migrations/001-init.ts` for the full schema (users, accounts, ledger, audit_log, notification_preferences, card_controls, limit_rules).

## OpenAPI

The machine-readable specification lives at `openapi/openapi.yaml`.
