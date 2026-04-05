# Backend Deploy Guide

## Fastest host choices
- Render: easiest for a quick hosted demo
- Railway: also good
- VPS: only if you want to manage everything yourself

## Recommended demo setup
For the first client-facing version, keep these in stub/demo mode:
- Kafka disabled
- KYC stub
- OAuth stub
- Interbank stub
- notifications stub

That reduces breakage and gets you to a working demo faster.

## Files added for deploy
- `.env.client.example` -> manual env template
- `render.yaml` -> one-click-ish Render blueprint

## Render deploy
1. Push this project to GitHub
2. In Render, create a new Blueprint using `render.yaml`
3. Let Render create the Postgres database
4. After deploy, copy the backend URL
5. Put that URL into frontend env:
   - `NEXT_PUBLIC_API_BASE_URL=https://YOUR-BACKEND/api/v1`
   - optional: `NEXT_PUBLIC_WS_URL=https://YOUR-BACKEND`

## Manual backend settings if not using render.yaml
Build command:
- `npm install && npm run build`

Start command:
- `npm run migration:run && npm run start`

## Required env vars
Minimum important ones:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `KAFKA_ENABLED=false`
- `OAUTH_MODE=stub`
- `KYC_PROVIDER_MODE=stub`
- `INTERBANK_MODE=stub`
- `NOTIFICATIONS_MODE=stub`

## Notes
- The backend already has a Dockerfile, but Render node runtime is simpler for now.
- Migrations should run before startup using the provided start command.
- After deploy, test:
  - `/docs`
  - `/api/v1/auth/register`
  - `/api/v1/accounts`

## Client-preview goal
This backend setup is aimed at a stable demo, not full production hardening.
