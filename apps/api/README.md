## Local Development

```bash
pnpm --filter api dev
```

- API: `http://localhost:3001`
- OpenAPI: `http://localhost:3001/openapi.json`

## Build Scripts

From `apps/api`:

```bash
pnpm run build
```

- `build`: builds `@fide.work/fcp` first, then runs local TypeScript build for API.
- `build:local`: runs only API TypeScript build (`tsc`).
- `build:api:prod`: delegates to repo root production API build.


From repo root:

```bash
pnpm run build:api:prod
```

## Entrypoints

- Local Node runtime: `src/index.ts`
- Vercel runtime: `api/[...route].ts`

## Environment

Copy and edit:

```bash
cp .env.example .env
```

`DATABASE_URL` is not read from `apps/api/.env`; DB configuration is provided by `@fide.work/db` via `/Users/chrislally/Desktop/fide.work/packages/db/.env`.
