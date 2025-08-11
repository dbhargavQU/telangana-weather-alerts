# Telangana Weatherman

Compact, bilingual (English + Telugu) weather alerts for Telangana with live radar, station data, and AI formatting. Built with Next.js 15, Prisma, Redis, and OpenAI.

## Features
- Area pages and shareable images
- Live radar and station ingest jobs
- Rule-based tweet decider with budget/gap controls
- AI formatter with deterministic fallback
- X (Twitter) posting with OAuth 1.0a

## Tech Stack
- Next.js 15 (App Router), React 18, Tailwind CSS
- Prisma + PostgreSQL
- BullMQ + Redis
- OpenAI (gpt-4o-mini)

## Getting Started

1) Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 6+

2) Install
```bash
pnpm install # or npm install / yarn
```

3) Environment
Create `.env` with at least:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/weatherman
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Tweeting (optional)
TWEET_ENABLE=false
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
```

4) Database
```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

5) Run Dev Server
```bash
pnpm dev
```

Open `http://localhost:3000`.

## Jobs / Workers
- One-off run: `pnpm ts-node scripts/run-jobs-once.ts`
- Worker (BullMQ): `pnpm ts-node scripts/worker.ts`

## Tweet Runner
- Decides areas/scopes via `jobs/tweetDecider.ts`
- Formats text via `lib/tweetFormat.ts` (`formatTweetWithAI` with 5s timeout, falls back deterministically)
- Posts via `lib/xClient.ts`

Run manually:
```bash
pnpm ts-node scripts/run-jobs-once.ts
```

## Testing
```bash
pnpm test
```

## Coding Standards
- ESLint + Prettier configured. Run:
```bash
pnpm lint && pnpm format
```

## Deployment
- Build: `pnpm build`
- Start: `pnpm start`

Ensure environment variables are set in production. Consider Vercel or a Node host with Redis and PostgreSQL.

## Security
- Do not commit `.env` or secrets.
- Rate-limit ingest endpoints and protect internal triggers.

## License
MIT


