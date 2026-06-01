# English Long Sentence Trainer

A Next.js full-stack learning system for English long-sentence reading, practice, teacher management, vocabulary tests, and AI-assisted feedback.

## Stack

- Next.js App Router
- Prisma 7
- PostgreSQL
- Sub2API or another OpenAI-compatible API
- Optional DeepSeek fallback

## Local Development

```bash
npm install
npm run db:generate
npm run dev
```

The app reads environment variables from `.env`. Do not commit `.env`.

## Required Environment Variables

Copy `.env.example` to `.env` and fill in real values:

```env
DATABASE_URL=""
AUTH_SECRET=""

ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_DISPLAY_NAME=""

SUB2API_BASE_URL=""
SUB2API_API_KEY=""
SUB2API_MODEL=""

DEEPSEEK_BASE_URL=""
DEEPSEEK_API_KEY=""
DEEPSEEK_MODEL=""
AI_TIMEOUT_MS=""
```

For local Sub2API exposed through ngrok, set `SUB2API_BASE_URL` to the ngrok HTTPS origin only, without `/v1`.

## Database Setup

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:import-vocab
```

`db:import-vocab` is safe to run more than once because it uses upserts.

## Production Build

```bash
npm run build
```

## Vercel Deployment

Recommended deployment:

- App: Vercel
- Database: Neon PostgreSQL
- AI gateway: Sub2API running locally through ngrok for testing, or on a VPS for stable production

Vercel build command:

```bash
npm run db:generate && npm run build
```

After changing Vercel environment variables, redeploy the project.

If Sub2API is served through ngrok, the computer running Docker and ngrok must stay online.

## CloudBase / Domestic Deployment

For a domestic deployment path, see:

- `docs/CloudBase-Webify-国内部署清单.md`

The repository includes a `Dockerfile` for container-based deployment. Normal Vercel and local builds are unchanged; set `NEXT_OUTPUT_MODE=standalone` only when building a standalone container image.
