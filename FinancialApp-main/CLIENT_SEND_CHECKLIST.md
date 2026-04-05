# Client Send Checklist

## What is ready now
- Frontend: Next.js app in rontend/
- Backend: NestJS API in project root
- Frontend lint passes
- Frontend production build passes
- PWA assets are already included

## Before sending to client
1. Deploy backend and set values from .env.client.example
2. Deploy frontend and copy rontend/.env.client.example to .env.local or your host env settings
3. Set NEXT_PUBLIC_API_BASE_URL to your deployed backend URL ending in /api/v1
4. Create a demo user account or keep registration enabled
5. Test these pages on phone:
   - /
   - /dashboard
   - /accounts
   - /payments
   - /notifications
   - /card-controls

## Suggested hosting
- Frontend: Vercel
- Backend: Render / Railway / VPS
- Database: managed Postgres
- Redis: managed Redis or disable non-essential flows for demo if needed

## What to send the client
- Live frontend URL
- Demo login credentials
- Short note: installable mobile web app / PWA, native packaging can follow

## Local commands
### Frontend
- 
pm install
- 
pm run lint
- 
pm run build
- 
pm run dev

### Backend
- 
pm install
- 
pm run migration:run
- 
pm run start:dev

## Important note
This is client-preview ready as a hosted mobile-friendly web app.
It is not yet a true React Native app.
