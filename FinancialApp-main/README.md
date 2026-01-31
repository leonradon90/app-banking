# Digital Banking MVP Core

A NestJS-based prototype implementing the core primitives of a digital bank: authentication/KYC, accounts, payments, ledger, audit logging, card controls, limits & anti-fraud hooks, and a push notification center.

## Features

- **Auth & KYC** – JWT authentication with simulated KYC lifecycle.
- **Accounts & Ledger** – Double-entry ledger with idempotent transfers and audit trail.
- **Payments** – P2P transfers guarded by configurable limits and anti-fraud checks.
- **Card Controls** – Freeze/unfreeze, MCC & geo limits, and Kafka fan-out.
- **Notifications** – Event-driven push center capturing transaction events.
- **Limits & Anti-Fraud** – Configurable per-transaction rules with audit records.
- **Interbank & Scheduling (stubbed)** – Optional interbank gateway stub + scheduled payments runner.
- **Tokenization (stubbed)** – PAN → token flow with optional AES-256 encryption.
- **Observability (stubbed)** – `/metrics` endpoint and trace logging.
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

## Frontend (Next.js console)

The operations console lives in `frontend/` and talks to the API via `NEXT_PUBLIC_API_BASE_URL`.

1. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```
2. **Set environment**
   ```bash
   cp .env.example .env.local
   ```
3. **Run the console**
   ```bash
   npm run dev -- -p 3001
   ```

   The console will be available at http://localhost:3001 and expects the API at http://localhost:3000/api/v1.

## Environment

Copy `.env.example` to `.env` and adjust credentials if needed.

### Notifications providers

This MVP can run in **stub** mode (no external credentials) or **real** mode.

- **Stub mode (default):** Sends are simulated and marked as delivered.
- **Real mode:** Provide Firebase + SendGrid credentials below and set `NOTIFICATIONS_MODE=real`.

```
NOTIFICATIONS_MODE=stub
WEBSOCKET_ENABLED=true
WEBSOCKET_CORS_ORIGIN=*
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_APP_ID=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=ALTX Finance
```

Device tokens for FCM can be registered via `POST /api/v1/notifications/devices`.

### Kafka

Kafka is optional at runtime. To disable external Kafka while keeping in-process events:
```
KAFKA_ENABLED=false
```

### Integration flags

```
OAUTH_MODE=stub|real
KYC_PROVIDER_MODE=stub|real
KYC_STORAGE_MODE=stub|real
INTERBANK_MODE=stub|real
SCHEDULER_ENABLED=true|false
AUDIT_WORM_MODE=stub|off|real
CARD_VAULT_MODE=stub|real
METRICS_ENABLED=true|false
TRACING_ENABLED=true|false
HTTPS_ENABLED=true|false
NOTIFICATIONS_KAFKA_CONSUMER_ENABLED=true|false
NOTIFICATIONS_KAFKA_CONSUMER_GROUP_ID=financial-app-notifications
LEDGER_EVENT_SIGNING_ENABLED=true|false
LEDGER_EVENT_HMAC_SECRET=your-secret
```

## Testing

```bash
npm test
```

## Observability

- Metrics: `GET /api/v1/metrics` (Prometheus) or `/api/v1/metrics/json`
- Trace header: `X-Trace-Id` returned on responses when tracing is enabled.

## Integration stubs

- OAuth status: `GET /api/v1/auth/oauth/status`
- OAuth token exchange (stub): `POST /api/v1/auth/oauth/token`
- KYC provider/storage status: `GET /api/v1/kyc/integrations/status`
- Card tokenization (stub): `POST /api/v1/card-controls/tokenize`
- Kafka consumer (optional): enable `NOTIFICATIONS_KAFKA_CONSUMER_ENABLED=true` to consume `transactions` topic.
- Ledger event signing (optional): enable `LEDGER_EVENT_SIGNING_ENABLED=true` and set `LEDGER_EVENT_HMAC_SECRET`.

## Architecture highlights

- Event-driven integrations via Kafka topics (`transactions`, `notifications`, `fraud_alerts`, `card_controls_events`).
- Audit logging for every critical action.
- Idempotency guaranteed with `Idempotency-Key` (UUID) stored in the ledger table.
- Trace IDs supported via `X-Trace-Id` (defaults to `Idempotency-Key` when omitted).
- Limits service is extensible for daily/monthly aggregations.
- Notification center is ready for WebSocket/Push integrations.
- Error responses follow `{ error: true, code, message }` with HTTP status metadata.
- OAuth/Keycloak, KYC provider, interbank gateway, storage, and TLS are stubbed behind env flags.

## Scheduling

- Schedule a payment by sending `scheduledFor` (ISO string) in `POST /api/v1/payments`.
- List schedules: `GET /api/v1/payments/schedules`
- Cancel schedule: `POST /api/v1/payments/schedules/:id/cancel`

## MVP architecture alignment

See `MVP_ARCHITECTURE_ALIGNMENT.md` for a detailed mapping between the MVP implementation and the provided architecture document.

## Database schema

See `src/database/migrations/001-init.ts` for the full schema (users, accounts, ledger, audit_log, notification_preferences, card_controls, limit_rules).

## OpenAPI

The machine-readable specification lives at `openapi/openapi.yaml`.
