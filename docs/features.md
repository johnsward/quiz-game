# DevOps features

A complete list of what the delivery setup does. For how to set it up see
[infra/README.md](../infra/README.md); for the reasoning behind the choices see
[architecture.md](architecture.md).

## Environments and promotion

- Three environments, `dev`, `test` and `prod`, running side by side on one Docker
  daemon with separate names (`quiz-<env>-*`), networks and database volumes.
- Branch-to-environment mapping: `dev` → dev, `test` → test, `main` → prod.
- Promotion by pull request from one branch into the next.
- Only the frontend publishes a port (8081, 8082, 8080), bound to `127.0.0.1`.
  Backend and database are reachable only inside their environment's network.
- Manual approval gate on `prod` through a GitHub Environment required reviewer.

## Infrastructure as code

- Terraform with the Docker provider describes the database, backend and frontend.
- One shared root configuration for every environment. Differences live in
  `infra/envs/<env>.tfvars`, so adding an environment is one new file.
- A reusable `service` module, instantiated once per container through a single
  `for_each`.
- Remote state in an S3-compatible MinIO bucket, with versioning, state locking and one
  state key per environment.
- MinIO is started and the bucket created automatically by the first deploy.
- Frontend and backend image tags are separate variables, so each service can be
  deployed and rolled back independently.

## Build

- Docker images for frontend (React, nginx) and backend (Node) built on GitHub's
  servers and pushed to GHCR.
- Multi-architecture images (`linux/amd64` and `linux/arm64`), so Apple Silicon and
  Intel machines both run natively.
- Dockerfiles run the Node build steps on the builder's native architecture to avoid
  QEMU crashes, and use multi-stage builds with a minimal runtime image.
- Runtime images are patched at build time (`apk upgrade`), the backend runs as a
  non-root user, and npm is removed from the final backend image.
- Immutable `:<sha>` tags for every build, plus a moving `:<branch>` tag per branch.
- Change detection: a service is rebuilt only when its files changed, or when its
  `:<branch>` tag does not exist yet.
- Image reuse: an unchanged service keeps the image built this run, else the one
  already running, else the latest `:<branch>` build.

## Deployment

- GitHub Actions deploy workflow on every push to `dev`, `test` and `main`, plus a
  manual **Run workflow** trigger.
- Self-hosted runner packaged as a container (`infra/runner`), registered with the
  `quiz-deploy` label and controlling the host's Docker through the mounted socket.
- Runner working directory mounted at the same absolute path on host and container, so
  bind-mount paths resolve correctly.
- Per-branch concurrency queue: deploys to the same branch run one at a time and are
  never cancelled midway.
- GitHub Environments with their own secrets and protection rules.
- Terraform `init`, `plan` and `apply` as visible steps, with the state key and MinIO
  endpoint injected at run time.
- Container logs printed automatically when a deploy fails.

## Post-deploy verification

- Smoke test on every environment: frontend health endpoint, backend health endpoint and
  leaderboard, all through the real published port.
- Integration test on `test`: submits a score and reads it back through nginx, the API
  and the database.
- A deploy counts as successful only after these pass.

## Continuous integration

Runs on pull requests into `dev`, `test` and `main`, only for the parts that changed
(path filters; a change to `ci.yml` runs everything):

- Frontend: oxlint (warnings fail the build), TypeScript type check, unit tests,
  production build.
- Backend: oxlint, type check, unit tests against a real Postgres service container,
  build.
- Migration compatibility, when migrations change: released migrations must not be
  modified, renamed or deleted; the pull request's migrations are applied to a fresh
  database and the previous release's tests are run against the new schema.
- Secret scan: gitleaks over the commits of the pull request.
- Dependency review: fails on newly introduced dependencies with high severity
  vulnerabilities.
- Docker image build for each changed service, followed by a Trivy scan that fails on
  HIGH or CRITICAL vulnerabilities (unfixed ones ignored).
- A single aggregate check, `ci-ok`, suitable as the one required status check.

## Security

- CodeQL static analysis for JavaScript and TypeScript (requires GitHub code scanning).
- Full-repository secret scanning with gitleaks (Security workflow).
- `npm audit` for dependency vulnerabilities.
- Trivy image scanning and dependency review in CI.
- Security workflow runs on pushes, pull requests and a weekly schedule, since new
  vulnerabilities appear without code changes. In-progress runs of the same event are
  cancelled when a newer one starts.
- Dependabot weekly updates for npm (both apps, minor and patch updates grouped), Docker
  base images and GitHub Actions, opened against `dev`.
- Secrets (MinIO credentials, database password) kept in GitHub Secrets, passed as
  environment variables for a single job and never baked into images.
- The privileged self-hosted runner is used only by the deploy job, which runs on
  pushes to the protected branches and never on pull requests.

## Releases and versioning

- Semantic versioning chosen with a pull request label: `release:major`,
  `release:minor` or `release:patch`.
- `scripts/next-version.sh` computes the next version from the latest `v*` tag and
  requires exactly one release label.
- "Release version" check on pull requests into `main` reports the version that would
  be released, or that a label is missing. It is advisory and does not block merging.
  Newer events on the same pull request cancel the run in progress.
- On merge to `main`, the release workflow creates the tag and a GitHub release with
  generated notes. It does not wait for the production approval.
- Release runs are queued, never cancelled, so versions cannot be skipped.

## Documentation and portability

- `infra/README.md`: step-by-step guide from fork to three running environments, with
  the purpose of each step, a setup checklist, operations (teardown, adding an
  environment) and a troubleshooting table.
- `docs/architecture.md`: the design and the reasons behind each choice.
- `.gitattributes` forces LF line endings for scripts, Dockerfiles, workflows and
  Terraform files, so Windows checkouts do not break them.
- Workflows call scripts through `bash`, so they do not depend on the executable bit.
- Tested on macOS and Windows with Docker Desktop. Linux needs a few adjustments.

## Operations

- Manual **Teardown** workflow: pick one environment or `all` and shut it down with
  `terraform destroy` on the runner. `prod` still needs approval, it shares the deploy
  queue so it never overlaps a deploy, the database volumes are kept unless you opt in
  to deleting them, and removing MinIO and its state is optional.
- Teardown by hand with `terraform destroy` per environment, then optional removal of
  MinIO and the runner.
- Adding an environment: one `.tfvars` file, a workflow mapping, a GitHub Environment
  and a branch.

## Limitations

- **Single runner and single host.** One self-hosted runner on one machine runs every
  deploy, so there is no isolation between environments: a runaway `dev` container can
  starve `prod`, and if the machine is off nothing deploys.
- **No high availability or zero downtime.** One instance of everything; a deploy
  replaces the container, leaving a short gap.
- **Local state store.** MinIO is a single container with one volume and no backup.
  Losing the volume makes Terraform forget what it deployed.
- **No database backups, TLS, load balancing or managed database.** Postgres is a
  container with a volume.
- **Privileged runner.** Access to the Docker socket is root-equivalent on the host. The
  pipeline relies on protected branches and on deploying only from pushes.
- **Images are rebuilt per branch, not promoted.** A promotion from `dev` to `test`
  rebuilds from source instead of moving the exact image that was tested.
- **Frontend and backend are promoted independently**, so they must stay compatible
  across versions.
- **Public images.** GHCR packages must be public because Terraform pulls without
  registry credentials.
- **Plan-dependent protections.** CodeQL, branch protection and environment reviewers
  need GitHub Advanced Security or a paid plan on private repositories.
- **Advisory release check.** A missing release label does not block a merge.
- **Third-party actions are pinned by version tag, not commit SHA.**
- **Platform coverage.** Tested on macOS and Windows with Docker Desktop; Linux needs
  adjustments.

## Future steps

- **One runner per environment**, ideally on separate machines: a `dev` runner, a `test`
  runner and a locked-down `prod` runner, each with its own label (for example
  `quiz-dev`, `quiz-test`, `quiz-prod`). This isolates environments, limits the
  blast radius of the privileged runner and lets several deploys run in parallel.
- **Promote the same image** (retag instead of rebuild) so the artifact that passed
  `test` is the one that reaches `prod`.
- **Rollback workflow** that redeploys the previous tag with one click.
- **Backups** of the Postgres volume and the MinIO state, or a managed state backend.
- **Zero-downtime deploys** (blue/green or rolling) and a real orchestrator such as
  Kubernetes, since the environment definition is already separate from where it runs.
- **Private images** with `registry_auth` in Terraform instead of public packages.
- **Pin actions to commit SHAs** and enforce signed images and an SBOM.
- **Ephemeral runners** (a fresh container per job) to reduce the risk of state leaking
  between jobs.
- **Make the release check required** once labelling is routine, and add automatic
  changelog or release-notes categories.
- **Monitoring and alerting** (health checks, logs, metrics) after deploy.
- **Linux support** (host gateway and MinIO binding) in the default configuration.
