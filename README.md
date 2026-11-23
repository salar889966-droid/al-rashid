# Al Rashid AI Marketing Studio

AI-assisted social media workflow for Al Rashid Technologies.

## Current milestone
Frontend foundation: dashboard, media-library UI, automatic-publishing preference, content queue preview and responsive layout.

> Publishing is intentionally disabled until a real Meta OAuth connection, permissions, backend job queue and media storage are configured. The current dashboard uses sample queue entries and local browser previews only.

## Stack
- React + TypeScript + Vite
- Lucide icons
- Planned backend: Node.js / TypeScript
- Planned database: PostgreSQL
- Planned integrations: OpenAI API and Meta Graph API

## Run locally
```bash
npm install
npm run dev
```

## Environment
Copy `.env.example` to `.env` when backend integration is added. Never put API secrets in frontend VITE_ variables or commit real secrets.

## Roadmap
1. Dashboard and media upload UI
2. Durable media storage and API
3. AI content generation and brand templates
4. Meta OAuth and account permissions
5. Background scheduler, publishing and retry handling
6. Analytics, audit logs and production deployment
