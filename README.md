# Absurdly True?

A quiz game built like a tabloid front page. You get 10 strange claims about history, nature and space. Stamp each one **True** or **Fake**, read the real story, build streaks for bonus points, and post your score to a global leaderboard.

The app has three services:

| Service      | Tech                                   | Role                                                  |
| ------------ | -------------------------------------- | ----------------------------------------------------- |
| **frontend** | React 19, TypeScript, Vite, nginx      | The game. nginx serves the built files and proxies `/api` |
| **backend**  | Node 22, Express 5, TypeScript         | REST API for the leaderboard                          |
| **db**       | PostgreSQL 17                          | Stores scores                                         |

```
browser ──► frontend (nginx :8080) ──/api──► backend (:3001) ──► db (:5432)
```

## Run everything with Docker

```bash
docker compose up --build
```

Then open http://localhost:8080.

## Local development

Requires Node 22+ and Docker (for the database).

```bash
npm install && npm run install:all      # root helper + both apps
cp backend/.env.example backend/.env    # local config for the backend
docker compose up -d db                 # Postgres on localhost:5432
npm run dev                             # backend :3001 + frontend :5173
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend.

The database is published on port **5432**. If that port is taken by another Postgres, set `DB_PORT` (e.g. `DB_PORT=5433`) before running `docker compose`, and update `DATABASE_URL` in `backend/.env` to match.

## Scripts

Run from the repo root (they run in both apps), or inside `frontend/` or `backend/`:

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start both apps with hot reload                |
| `npm run typecheck` | Run the TypeScript compiler                    |
| `npm test`          | Run the unit tests (Vitest)                    |
| `npm run build`     | Production build of both apps                  |

Backend only:

| Script            | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run migrate` | Apply pending database migrations                     |
| `npm start`       | Run the compiled server (`dist/server.js`)            |

### Database integration tests

The tests in `backend/src/postgresRepository.test.ts` run against a real database only when `TEST_DATABASE_URL` is set. Otherwise they are skipped. **They wipe the `scores` table**, so use a separate database:

```bash
docker compose exec db psql -U quiz -d quiz -c "CREATE DATABASE quiz_test"
TEST_DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz_test npm test --prefix backend
```

## API

All routes are under `/api`.

| Method | Path                     | Description                                                  |
| ------ | ------------------------ | ------------------------------------------------------------ |
| GET    | `/api/health`            | `200 {status:"ok"}`, or `503` if the database is unreachable |
| GET    | `/api/leaderboard?limit` | Top scores (default 10, max 50)                              |
| POST   | `/api/scores`            | Body `{name, score, correct}`. Returns `201 {entry, rank}`   |

Score submissions are validated:
- `name` must be 1–24 characters with no control characters.
- `correct` must be from 0 to 10.
- `score` must be possible for that number of correct answers.

Submissions are rate-limited to 10 per minute per client.

## Configuration (backend)

| Variable       | Default | Description                                                  |
| -------------- | ------- | ------------------------------------------------------------ |
| `DATABASE_URL` | —       | Postgres connection string (required)                        |
| `PORT`         | `3001`  | Port the API listens on                                      |
| `TRUST_PROXY`  | `0`     | Set to `1` behind a reverse proxy so rate limiting sees real client IPs |

Migrations in `backend/migrations/*.sql` run automatically when the server starts. They are tracked in a `schema_migrations` table, and a Postgres advisory lock stops two processes running them at once.

## Project structure

```
├── docker-compose.yml
├── package.json            # Root helper scripts (runs both apps)
├── frontend/
│   ├── Dockerfile          # Build with Node, serve with nginx
│   ├── nginx.conf          # Static files + /api proxy
│   └── src/
│       ├── api/            # Leaderboard API client
│       ├── components/     # React components
│       ├── game/           # Pure game logic + tests
│       ├── data/           # Question bank
│       └── styles/
└── backend/
    ├── Dockerfile
    ├── migrations/         # SQL migrations, applied in filename order
    └── src/
        ├── server.ts       # Entry point: migrate, then listen
        ├── app.ts          # Express app and routes
        ├── validation.ts   # Request validation
        ├── postgresRepository.ts
        ├── migrate.ts
        ├── config.ts
        └── test/           # In-memory repository for tests
```

## How scoring works

- A correct answer is worth **100** points.
- Each further correct answer in a row adds **+25**, up to a maximum of **+100** (200 points per claim).
- A wrong answer resets the streak.
- Your rank depends on how many claims you got right: Editor-in-Chief, Fact Checker, Staff Reporter, Intern or Tabloid Believer.

If you change these rules in `frontend/src/game/logic.ts`, update the matching limits in `backend/src/validation.ts`.

## Adding questions

Add an entry to `frontend/src/data/questions.ts`:

```ts
{
  id: 'unique-id',
  claim: 'The statement shown to the player.',
  isTrue: true,
  explanation: 'The real story, shown after the player answers.',
}
```

## DevOps pipeline (dev → test → prod)

Three environments run locally in Docker, provisioned by Terraform and deployed by GitHub Actions on a self-hosted runner. See [docs/architecture.md](docs/architecture.md).

| Env  | Branch | URL                   | Gate                    |
| ---- | ------ | --------------------- | ----------------------- |
| dev  | `dev`  | http://localhost:8081 | auto                    |
| test | `test` | http://localhost:8082 | auto + integration test |
| prod | `main` | http://localhost:8080 | manual approval         |

The ports are defaults, declared as `frontend_host_port` in `infra/envs/<env>.tfvars`; change them there (other tunables are in `infra/variables.tf`).

### Setup
Branches, GitHub environments and secrets, the self-hosted runner, GHCR visibility and troubleshooting are all covered step by step in **[infra/README.md](infra/README.md)**.

### Quality & security automation
oxlint, typecheck, tests, build, migration compatibility check, Trivy image scan, gitleaks, dependency review, CodeQL, `npm audit`, Dependabot.

### Terraform layout
One root configuration in `infra/` serves every environment. Per-environment values live in `infra/envs/<env>.tfvars` (name and host port); the state key is passed at `init` (`-backend-config="key=<env>/terraform.tfstate"`). Adding an environment = one new `.tfvars` file. The three containers are defined once in `locals.services` and created by a single `for_each` over `infra/modules/service`.
