# Vercel Frontend Deploy

## Project root on Vercel
Set the **Root Directory** to:
- `frontend`

## Framework
- Next.js

## Build settings
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave default for Next.js

## Required environment variable
Set this in Vercel:
- `NEXT_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-DOMAIN/api/v1`

Optional if you use live websocket updates from the hosted backend:
- `NEXT_PUBLIC_WS_URL=https://YOUR-BACKEND-DOMAIN`

## Before clicking deploy
Make sure your backend is reachable publicly and CORS is enabled.

## After deploy
Test these pages:
- `/`
- `/dashboard`
- `/accounts`
- `/payments`
- `/notifications`
- `/card-controls`

## Notes
- This frontend already passes `npm run lint`
- This frontend already passes `npm run build`
- Vercel should auto-detect it as a Next.js project
