# Architecture

```
PR ──► ci.yml (paths-filtered: frontend | backend | infra) ──► ci-ok (required check)
push dev/test/main ──► deploy.yml
   build job (GitHub-hosted): build + push changed images to GHCR, tag = commit SHA
   deploy job (self-hosted runner, GitHub Environment): terraform init/plan/apply → smoke test (→ integration test on test)

Per environment (one shared Terraform root infra/ + envs/<env>.tfvars, state in MinIO at tfstate/<env>/):
  docker network quiz-<env>
   ├─ quiz-<env>-frontend (nginx, host port 8081/8082/8080) ──/api──► quiz-<env>-backend (Express :3001)
   └─ quiz-<env>-db (Postgres 17 + volume)  ◄── DATABASE_URL ── backend
```

## Design decisions
- **No duplication**: a single root in `infra/` is reused by all environments; `locals.services` describes db/backend/frontend once and one `for_each` instantiates `infra/modules/service`. Environments differ only by `.tfvars` (name, port) and secrets/image tags passed as variables.
- **Isolated state**: one S3-compatible (MinIO) state key per environment, with lockfile-based locking.
- **Immutable tags**: images are tagged by commit SHA. Each push to an environment branch builds the changed service(s) from that commit (so a promotion merge rebuilds from the same source rather than re-using the lower environment's image; true build-once promotion would retag the existing image — a possible improvement).
- **Independent promotion**: the deploy job keeps the image currently running for a service unless that service's files changed in the push.
- **Path filtering** keeps CI fast and avoids unrelated rebuilds.

## Limitations
- All environments share one host: no resource or fault isolation.
- The self-hosted runner has Docker socket access (effectively root); restrict to protected branches.
- No TLS, load balancing or managed database; MinIO state is local and unbacked-up.
- Branch-per-environment promotion diverges from trunk-based development.
- Independent promotion requires frontend/backend API compatibility.
