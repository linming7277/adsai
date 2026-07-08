# AdsAI

AdsAI is a Go + Next.js SaaS codebase for ad-link automation, landing-page evaluation, task orchestration, and account operations. This repository is intended as a second-development base: product identity, runtime domains, cloud project IDs, OAuth credentials, and secrets must be configured by the new owner before deployment.

## Architecture

### Frontend

- Next.js App Router frontend in `apps/frontend`
- Supabase Auth integration
- User-centric dashboard routes under `/dashboard`, `/settings`, and `/manage`
- Next gateway routes for business APIs and ops console proxying

### Backend

- Go services under `services/*`
- Shared Go packages under `pkg/*`
- Shared TypeScript packages under `packages/*`
- API specifications under `specs/openapi`
- SQL schema and migrations under `schemas/sql`, `database/migrations`, `migrations`, and `supabase/migrations`

Main service areas:

- `adscenter`
- `batchopen`
- `billing`
- `browser-exec`
- `console`
- `gateway-middleware`
- `offer`
- `siterank`
- `user`
- `useractivity`

### Infrastructure

- Docker and Cloud Run oriented deployment files under `configs`, `deployments`, and `infrastructure`
- Pub/Sub, scheduler, API gateway, monitoring, and Secret Manager helper scripts
- Environment templates in `.env.example`, `.env.preview.template`, `.env.production.template`, and `configs/environments`

## Project Structure

```text
adsai/
├── apps/frontend/          # Next.js frontend
├── services/               # Go microservices
├── pkg/                    # Shared Go packages
├── packages/               # Shared TypeScript packages
├── specs/openapi/          # API contracts
├── schemas/                # SQL and event schemas
├── database/               # Database migrations and optimization helpers
├── migrations/             # Service migration definitions
├── supabase/               # Supabase migrations and schema backups
├── configs/                # Runtime and Docker configuration
├── deployments/            # Deployment manifests and scripts
├── infrastructure/         # Cloud infrastructure setup scripts
├── scripts/                # Development, migration, OpenAPI, and ops scripts
└── docs/                   # Current project documentation
```

## Requirements

- Node.js >= 22
- npm >= 10
- Go toolchain matching `go.work`
- Docker and Docker Compose
- PostgreSQL-compatible database for business data
- Supabase project for authentication
- Redis-compatible cache for services that require it

## Setup

Install JavaScript dependencies:

```bash
npm install
```

Copy and edit environment files:

```bash
cp .env.example .env.local
```

At minimum, review and replace all placeholder values such as:

- `your-gcp-project-id`
- `example.com`
- `preview.example.com`
- Supabase URL and keys
- database URLs
- Redis URL
- OAuth redirect URLs
- internal service tokens

## Development

Run the frontend:

```bash
npm run dev:frontend
```

Run the configured Go services:

```bash
npm run dev:services
```

Run both together:

```bash
npm run dev
```

Build all workspaces:

```bash
npm run build
```

## Configuration

Environment variable inventory lives in:

- `configs/environment/variables.json`
- `.env.example`
- `.env.preview.template`
- `.env.production.template`
- `configs/environments/preview.yaml`
- `configs/environments/production.yaml`

Runtime domains are placeholders by default:

- Preview: `preview.example.com`
- Production: `example.com` and `www.example.com`

Replace these before enabling OAuth, CORS, canonical URLs, Firebase/Supabase callbacks, Cloud Build triggers, or production traffic.

## API Contracts

OpenAPI specs are stored in `specs/openapi`.

Useful commands:

```bash
scripts/openapi/ci-check.sh
scripts/openapi/generate-types.sh
```

Generated TypeScript API types are exposed through `@adsai/shared-types`.

## Database

Schema and migration sources are split by subsystem:

- `schemas/sql/*.sql`
- `database/migrations/*.sql`
- `migrations/*/*.yaml`
- `supabase/migrations/*.sql`

Use the service-specific runbooks and scripts in `scripts/migration`, `scripts/sql`, and `scripts/supabase` when applying migrations.

## Operations

Management and internal APIs use these route conventions:

- Business API gateway: `/go/*`
- Ops console gateway: `/ops/*`
- Go console routes: `/console/*`
- Go console API: `/api/v1/console/*`

Internal automation can use `X-Service-Token` with `INTERNAL_SERVICE_TOKEN` where supported.

## Runtime Controls

### Rate Limits

Next-side rate limit defaults can be tuned with:

- `RATE_LIMIT_API_PER_MINUTE`
- `RATE_LIMIT_SITERANK_PER_MINUTE`
- `RATE_LIMIT_ADSCENTER_PER_MINUTE`
- `RATE_LIMIT_BATCHOPEN_PER_MINUTE`
- `RATE_LIMIT_AUTH_PER_MINUTE`

Backend services remain the authority for final enforcement.

### SiteRank Cache

- Successful results are cached for 7 days.
- Error results are cached for 1 hour.
- Set `SITERANK_CACHE_DISABLED=true` to disable cache temporarily.
- Use `forceRefresh=true` to refresh an individual domain where supported.

### Observability

- Requests propagate `X-Request-Id`.
- Core routes may return `Server-Timing`.
- SiteRank routes may return `X-Cache-Hit`.

## Verification

Basic checks:

```bash
npm run lint
npm run test
scripts/check-pkg-replace.sh
scripts/openapi/ci-check.sh
```

Go verification requires a local Go toolchain available on `PATH`.

## License

MIT License
