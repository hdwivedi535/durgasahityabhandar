# Durga Sahitya Bhandar

B2B religious book catalogue + enquiry CRM platform.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** Fastify, TypeScript, MongoDB
- **Shared:** Permission definitions, shared types

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local MongoDB)

### Setup

```bash
# Install dependencies
npm install

# Start MongoDB
docker compose up -d

# Configure environment
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Seed database (permissions, roles, super admin)
npm run seed

# Start development servers
npm run dev
```

- Public website: http://localhost:3000
- Admin login: http://localhost:3000/login
- API: http://localhost:4000/api/v1

**Default super admin (after seed):**
- Email: `admin@dsb.local`
- Password: `Admin@123456`

Change these in production.

## Project Structure

```
frontend/     Next.js public site + admin CRM
backend/      Fastify REST API
shared/       Shared types and permissions
docs/         Architecture documentation
```

## Development Phases

| Phase | Status |
|-------|--------|
| 1 — Architecture | Complete |
| 2 — Foundation | In progress |
| 3 — CMS + Catalogue | Planned |
| 4 — CRM | Planned |

See [docs/PHASE-1-ARCHITECTURE.md](docs/PHASE-1-ARCHITECTURE.md) for full architecture.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Seed database |
