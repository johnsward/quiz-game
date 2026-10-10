# Deployment guide

This guide takes you from a fresh fork to three running environments
(`dev`, `test`, `prod`) on your own machine, deployed by GitHub Actions. Follow the
steps in order. Each step says what to do and why. For the design rationale see
[../docs/architecture.md](../docs/architecture.md).

## Contents

1. [How it works](#how-it-works)
2. [Setup checklist](#setup-checklist)
3. [Prerequisites](#prerequisites)
4. [Step 1: Fork and clone](#step-1-fork-and-clone)
5. [Step 2: Enable GitHub Actions](#step-2-enable-github-actions)
6. [Step 3: Create the branches](#step-3-create-the-branches)
7. [Step 4: Configure the repository](#step-4-configure-the-repository)
8. [Step 5: Start the self-hosted runner](#step-5-start-the-self-hosted-runner)
9. [Step 6: First deployment](#step-6-first-deployment)
10. [Step 7: Verify](#step-7-verify)
11. [Day-to-day workflow](#day-to-day-workflow)
12. [Operations](#operations)
13. [Troubleshooting](#troubleshooting)

## How it works

```
pull request ──► ci.yml            lint, typecheck, tests, build, migration check, secrets, dependency review, Trivy
              ├► security.yml      CodeQL, gitleaks, npm audit
              └► release-check.yml (PRs into main) is a release label set?

push to dev | test | main
  └─► deploy.yml
        build  (GitHub-hosted)   build and push multi-arch images to GHCR, only for services
                                 whose files changed (or that have no image yet)
        deploy (YOUR machine)    start MinIO if needed → terraform init/plan/apply
                                 → smoke test (→ integration test on `test`)
push to main
  └─► release.yml                create a tagged GitHub release from the PR's label
```

| Branch | GitHub Environment | Frontend URL          | Gate                          |
|--------|--------------------|-----------------------|-------------------------------|
| `dev`  | `dev`              | http://localhost:8081 | automatic                     |
| `test` | `test`             | http://localhost:8082 | automatic + integration test  |
| `main` | `prod`             | http://localhost:8080 | manual approval (reviewer)    |

Each environment gets its own Docker network, three containers
(`quiz-<env>-frontend`, `-backend`, `-db`) and a `quiz-<env>-db-data` volume.

The ports in the table above (8081, 8082, 8080) are defaults, set as
`frontend_host_port` in `infra/envs/<env>.tfvars`. Every other tunable value (container
ports, database name and user, image names, health-check paths, bind address, restart
policy, timeouts) is a variable in `infra/variables.tf` with a default, and can be
overridden in the same `.tfvars` files. The MinIO ports (9000/9001) are not Terraform
variables: they are set in the "Ensure state backend" step of `deploy.yml`.
Terraform state for all environments lives in one MinIO container
(`quiz-tfstate-minio`, ports 9000/9001) under `tfstate/<env>/terraform.tfstate`.

The `deploy` job runs on a **self-hosted runner**: a container on your machine that
controls your local Docker daemon. That is how a GitHub workflow can deploy to
`localhost`.

## Setup checklist

Everything you must do, with its purpose. Details are in the steps below.

| # | Action | Where | Purpose |
|---|--------|-------|---------|
| 1 | Fork and clone the repository | GitHub, terminal | Your own copy to run workflows on |
| 2 | Enable Actions on the fork | Actions tab | Forks have workflows disabled by default |
| 3 | Create `dev` and `test` branches | terminal | Workflows deploy only from `dev`, `test`, `main` |
| 4 | Create environments `dev`, `test`, `prod` (prod needs a reviewer) | Settings → Environments | Approval gate for production; `deploy` selects its environment by branch |
| 5 | Add secrets `TFSTATE_ACCESS_KEY`, `TFSTATE_SECRET_KEY`, `DB_PASSWORD` | Settings → Secrets | Credentials for the Terraform state store and the app database |
| 6 | Create labels `release:major`, `release:minor`, `release:patch` | Issues → Labels | Choose the semantic version a PR releases |
| 7 | Fork PR approval and Actions permissions | Settings → Actions | Keeps untrusted code off the runner |
| 8 | (Recommended) Branch protection with `ci-ok` | Settings → Branches | Every change is tested before it can deploy |
| 9 | (Private repos) Check code scanning availability | Settings → Advanced Security | CodeQL needs it |
| 10 | Start the runner container with a registration token | terminal, Settings → Runners | Executes the `deploy` job on your machine |
| 11 | Push to `dev`, then make the GHCR packages public | terminal, GitHub Packages | Docker must be able to pull the built images |

## Prerequisites

On the machine that will host everything:

- **macOS or Windows with Docker Desktop**, running. These are the tested setups.
  See [Windows](#windows) for two things to watch. Linux needs changes (see [Linux](#linux)).
- Free host ports: by default **8080, 8081, 8082** (the three apps, changeable in
  `infra/envs/*.tfvars`) and **9000, 9001** (MinIO, set in `deploy.yml`).
- `git`.
- A GitHub account. Admin access to the fork's settings.
- Optional, only for tearing down (see [Stop and tear down](#stop-and-tear-down)):
  Terraform >= 1.10 (`brew install terraform`). The pipeline installs its own.
- Internet access (GitHub, GHCR, Docker Hub, Terraform provider registry).

## Step 1: Fork and clone

On GitHub click **Fork**, keep all branches off (only `main` is needed). Then:

```bash
git clone git@github.com:<you>/quiz-game.git
cd quiz-game
```

Image names and URLs derive from the repository name automatically
(`ghcr.io/<you>/<repo>/frontend`), so no files need editing after forking.

## Step 2: Enable GitHub Actions

Forks start with workflows turned off. Open the fork's **Actions** tab and click
**"I understand my workflows, go ahead and enable them"**.

Scheduled workflows (the weekly Security scan) only run on the default branch
(`main`), which is already the case.

## Step 3: Create the branches

The workflows only run for `dev`, `test` and `main`. `main` exists; create the rest:

```bash
git checkout main
git checkout -b dev  && git push -u origin dev
git checkout main
git checkout -b test && git push -u origin test
git checkout main
```

> Pushing to these branches starts deployments. If you do this before finishing
> Steps 4–5, the first deploy will fail or wait, which is harmless. You can
> re-run it later from the Actions tab. To avoid noise, finish Steps 4 and 5 first.

## Step 4: Configure the repository

All in the fork's **Settings** tab.

### 4.1 Environments

*Purpose: `deploy.yml` runs each deploy in the environment named after the branch,
and `prod` is protected by a reviewer.*

Settings → Environments → **New environment**. Create three, with exactly these names:

| Name   | Protection rules                                                          |
|--------|---------------------------------------------------------------------------|
| `dev`  | none                                                                      |
| `test` | none                                                                      |
| `prod` | **Required reviewers**: add yourself (every prod deploy waits for approval) |

Optional: set **Deployment branches** to the matching branch (`dev`, `test`, `main`).
A missing environment makes the `deploy` job fail at startup. `main` maps to `prod`.

> Environment protection rules on private repositories need a paid GitHub plan.
> On a public repository (the fork of a public repo is public) they are free.

### 4.2 Secrets

*Purpose: Terraform state needs a store with credentials, and the database needs a
password. Nothing secret is ever committed.*

Settings → Secrets and variables → Actions → **New repository secret**. Repository
secrets are inherited by all three environments. An environment secret with the same
name overrides it (e.g. a different `DB_PASSWORD` for `prod`).

| Secret               | Value                                    | Notes |
|----------------------|------------------------------------------|-------|
| `TFSTATE_ACCESS_KEY` | `tfstate`                                | MinIO root user. Must be identical in every environment. |
| `TFSTATE_SECRET_KEY` | a password you choose (>= 8 characters)  | MinIO root password. Identical everywhere: all environments share one MinIO, created with these values on the first deploy. |
| `DB_PASSWORD`        | a password you choose                    | Postgres password. Avoid `@ : / # %` (it goes into a connection URL). Can differ per environment. |

`GITHUB_TOKEN` is provided automatically and is used to push images to GHCR.

> Changing a secret later does not change already-created services. For
> `TFSTATE_*` delete the `quiz-tfstate-minio` container and volume; for
> `DB_PASSWORD` destroy the environment (this deletes its data).

### 4.3 Release labels

*Purpose: the version of each release is chosen by a label on the pull request into
`main` (see [Releases](#releases)).*

Issues → Labels → **New label**. Create: `release:major`, `release:minor`,
`release:patch`.

### 4.4 Actions permissions and fork pull requests

*Purpose: the runner has access to your Docker daemon, which is effectively root on
your machine. It must never run code from strangers.*

Settings → Actions → General:

- **Actions permissions**: allow GitHub-created actions and the third-party ones
  used here (`dorny/paths-filter`, `docker/*`, `hashicorp/setup-terraform`,
  `gitleaks/gitleaks-action`).
- **Fork pull request workflows from outside collaborators**: select
  **Require approval for all outside collaborators**.

`deploy.yml` only triggers on pushes to the three branches, never on pull requests,
and only the `deploy` job uses the self-hosted runner. Never add `runs-on:
self-hosted` to a workflow that triggers on `pull_request`.

### 4.5 Branch protection (recommended)

*Purpose: every change is tested before it can be merged and therefore deployed.*

Settings → Branches → add a rule for each of `dev`, `test` and `main`:

- Require a pull request before merging.
- Require status checks to pass: **`ci-ok`** (the aggregate check from `ci.yml`).
- Block force pushes.

> On private repositories these rules need a paid plan. Without them the pipeline
> still works; you just aren't prevented from pushing untested changes.

### 4.6 Code scanning

*Purpose: the `codeql` job in `security.yml` uploads results to the Security tab.*

- **Public repo**: works as is.
- **Private repo**: needs GitHub Advanced Security; otherwise the CodeQL job fails.
  Make the repo public or remove the `codeql` job from `security.yml`.
- If **Default setup** for code scanning is on (Settings → Advanced Security),
  turn it off. It conflicts with the workflow.
- The `dependencies` job in `ci.yml` (dependency review) needs the **Dependency
  graph** enabled (Settings → Advanced Security). On a private repo it also needs
  GitHub Advanced Security; without it, remove that job (and from `ci-ok`'s `needs`).

### 4.7 Dependabot

*Purpose: weekly pull requests that update npm packages, base images and GitHub
Actions. Terraform providers are not covered.*

Nothing to configure beyond `.github/dependabot.yml`, which is already in the repo
and targets the `dev` branch. If Dependabot is off, enable it under Settings →
Advanced Security → Dependabot.

## Step 5: Start the self-hosted runner

*Purpose: the `deploy` job needs a machine that can reach your Docker daemon and
localhost. The runner is a container that registers itself with your fork using the
label `quiz-deploy` (which `deploy.yml` requires) and controls the host's Docker
through the mounted `/var/run/docker.sock`.*

1. Get a registration token: fork → Settings → Actions → Runners →
   **New self-hosted runner** → Linux → copy the token from the
   `./config.sh … --token <TOKEN>` line. It expires after about an hour.
2. Configure and start (from the repository root):

   ```bash
   cp infra/runner/.env.example infra/runner/.env
   ```

   Edit `infra/runner/.env`:

   | Variable | Value |
   |----------|-------|
   | `GITHUB_REPO_URL` | `https://github.com/<you>/quiz-game` (your fork's URL) |
   | `GITHUB_RUNNER_TOKEN` | the token from step 1 |
   | `RUNNER_NAME` | optional, default `quiz-runner` |
   | `RUNNER_WORK_DIR` | an **absolute path on your machine**, e.g. `/Users/<you>/quiz-runner-work` |

   ```bash
   docker compose -f infra/runner/docker-compose.yml up -d --build
   docker compose -f infra/runner/docker-compose.yml logs -f github-runner
   ```

   The first start downloads the runner, registers it and prints
   `Listening for Jobs`.
3. Check Settings → Actions → Runners: `quiz-runner` should be **Idle**.

**`RUNNER_WORK_DIR` must be a real absolute host path.** It is mounted into the
container at the *same* path. Jobs run `docker` commands against the host daemon,
which resolves paths on the host, so the repository checkout must live at an
identical path in both places. On macOS it must be inside a folder Docker Desktop
shares (anything under `/Users` works by default). If you place it inside the repo,
use `infra/runner/work` (already in `.gitignore`); otherwise put it outside the repo.

Registration is stored in `RUNNER_WORK_DIR`, so restarting the container needs no new
token. After changing anything under `infra/runner/`, rebuild with `up -d --build`.
`infra/runner/.env` is git-ignored.

## Step 6: First deployment

1. Push (or merge) to `dev`:

   ```bash
   git push origin dev
   ```
2. Watch Actions → **Deploy**:
   - `build`: "Decide what to build" selects services (everything on the first run,
     because no image exists yet); images are pushed with the commit SHA and a
     moving `:<branch>` tag.
   - `deploy`: "Ensure state backend (MinIO)" starts MinIO and creates the versioned
     `tfstate` bucket; "Resolve image tags" picks the images; Terraform applies;
     the smoke test calls `/healthz`, `/api/health` and `/api/leaderboard`.

### Make the images public (one time)

*Purpose: Terraform pulls images through your local Docker daemon, which has no
GHCR credentials. New packages are private, so the first deploy fails with
`unauthorized` at `terraform apply`.*

After the first successful `build` job:

1. GitHub profile → **Packages** → `<repo>/frontend` → **Package settings** →
   Danger Zone → **Change visibility** → **Public**.
2. Same for `<repo>/backend`.
3. Actions → the failed run → **Re-run failed jobs**.

Images contain only the built app; secrets are injected at deploy time.

Then repeat for the other environments: push to `test` (also runs
`scripts/integration-test.sh`) and merge into `main` (waits for your approval on
`prod`). These reuse the same public package settings; each branch builds its own
images the first time.

## Step 7: Verify

- The Deploy run is green, including "Smoke test".
- `docker ps` shows `quiz-dev-frontend`, `quiz-dev-backend`, `quiz-dev-db` and
  `quiz-tfstate-minio`, all `healthy`.
- http://localhost:8081 (dev) opens the game; http://localhost:8082 (test) and
  http://localhost:8080 (prod) after their deploys.
- `docker image inspect <frontend image> --format '{{.Architecture}}'` prints
  `arm64` on Apple Silicon and `amd64` on Intel (images are multi-arch).

## Day-to-day workflow

```
feature branch ──PR──► dev ──PR──► test ──PR──► main
                       │            │            └─ + release label → prod deploy (approval) + release
                       └ deploys    └ deploys + integration test
```

A merge is a push to the target branch, which starts its deploy.

### Which image gets deployed

Per service (frontend, backend), in this order:

1. built in this run → the new commit's `:<sha>` tag;
2. otherwise the image of the container that is already running;
3. otherwise (nothing running, e.g. after a destroy) → the `:<branch>` tag, the
   latest build for that branch.

A service is built only if files under `frontend/` or `backend/` changed, or if its
`:<branch>` tag does not exist yet. To force a rebuild of both: Actions → Deploy →
**Run workflow** → choose the branch.

Images are multi-arch (`linux/amd64`, `linux/arm64`). The Dockerfiles run Node build
stages with `--platform=$BUILDPLATFORM` to avoid Node under QEMU emulation, which
crashes on Node 22. The backend copies pure-JavaScript production dependencies from
that native stage; if you add a dependency with a native addon, the `deps` stage in
`backend/Dockerfile` must build per architecture again.

### Releases

Merging a pull request into `main` publishes a tagged GitHub release (`v1.4.0`) with
generated notes. `release.yml` runs as soon as the merge lands and does not wait for
the `prod` deploy approval.

Add **exactly one** label to every pull request into `main`: `release:major`,
`release:minor` or `release:patch`. The new version is the latest `v*` tag bumped
accordingly; the first release starts from `v0.0.0`, so `release:minor` gives
`v0.1.0` and `release:major` gives `v1.0.0`.

The **Release version** check on the PR fails until exactly one label is set and
shows the version that will be released. It is advisory, not a required check: a PR
without a label can still be merged, but the release job then fails and no release
is created. A direct push to `main` without a PR creates no release. The logic is
in `scripts/next-version.sh`.

## Operations

### Stop and tear down

**From GitHub:** open **Actions → Teardown → Run workflow**, pick `dev`, `test`, `prod`
or `all`, and run it. It runs `terraform destroy` on your runner, one environment at a
time, and `prod` still waits for its required reviewer. Tick *Also remove the MinIO state
backend* (only with `all`) to remove MinIO and the state as well. By default the
database volumes are **kept**, so a later deploy starts with the same data; tick
*Also delete the database volumes* to remove them. The workflow must exist on the
default branch (`main`) to appear in the Actions tab. The manual steps below always
delete the volumes.

**By hand:**

Destroy each environment **while MinIO is still running** (it holds the state). From
the host, Terraform reaches MinIO at `127.0.0.1:9000`:

```bash
cd infra
export AWS_ACCESS_KEY_ID=tfstate AWS_SECRET_ACCESS_KEY=<TFSTATE_SECRET_KEY>
terraform init -reconfigure -backend-config="key=dev/terraform.tfstate"
terraform destroy -var-file=envs/dev.tfvars \
  -var db_password=x -var frontend_image=x -var backend_image=x
```

Repeat with `test` and `prod`. **This deletes the database volumes and their data.**
The `-var` values are placeholders. Check with `docker ps -a | grep quiz-`.

Then, optionally:

```bash
docker rm -f quiz-tfstate-minio                          # state backend
docker volume rm quiz-tfstate-minio                      # deletes all state
docker compose -f infra/runner/docker-compose.yml down   # runner (also remove it in GitHub)
```

To pause without destroying: `docker stop quiz-<env>-frontend quiz-<env>-backend quiz-<env>-db`.

### Add another environment

1. Add `infra/envs/<name>.tfvars` with a unique `environment` and `frontend_host_port`, plus any other
   variable from `infra/variables.tf` you want to override.
2. Add the branch to the `branches` lists in `deploy.yml`, `ci.yml` and
   `security.yml`, create a matching GitHub Environment, and create the branch.
   Any branch other than `main` uses its own name as environment; `main` is `prod`.

### Windows

Tested on Windows with Docker Desktop; the full flow works. Two things are worth knowing:

> **Warning: the scripts must be marked executable in Git.** Windows has no executable
> bit, so if you *copy* the files into a new repository (instead of forking or cloning
> it), Git records `scripts/*.sh` as non-executable and they fail with a permission
> error on the runner. Fork or clone to keep the flag. If you already copied them, fix
> it with:
>
> ```bash
> git update-index --chmod=+x scripts/*.sh infra/runner/entrypoint.sh
> git commit -m "make scripts executable" && git push
> ```
>
> The workflows call the scripts through `bash` as a safeguard, but keeping the flag
> set is still correct.

Line endings: Git must not convert them to CRLF, which breaks scripts inside the Linux
containers. The repo ships a `.gitattributes` that forces LF for scripts, Dockerfiles,
workflows and Terraform files; if you cloned before it existed, run
`git add --renormalize .`. Also keep `RUNNER_WORK_DIR` a path that resolves the same
on the host and in the container (see [Start the runner](#step-5-start-the-self-hosted-runner)); if
bind mounts in a deploy look empty, this is the first thing to check.

### Linux

Not tested. Two things differ from macOS: `host.docker.internal` does not exist by
default (add `extra_hosts: ["host.docker.internal:host-gateway"]` to the runner
service and `--add-host=host.docker.internal:host-gateway` to the `docker run`
commands in `deploy.yml`), and MinIO is published only on the host's `127.0.0.1`,
which `host-gateway` does not reach, so the MinIO port binding would need to change.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Workflows never start on the fork | Actions not enabled — see Step 2. |
| Deploy job never starts / "Queued" | Runner offline or missing the `quiz-deploy` label (Settings → Actions → Runners), or the environment is waiting for a reviewer (**Review deployments** button on the run). |
| `Unable to locate executable file: unzip` | Runner image is stale. `docker compose -f infra/runner/docker-compose.yml up -d --build`. |
| Runner container exits at start with a token error | Registration token expired or already used. Generate a new one, update `infra/runner/.env`, then `up -d --force-recreate github-runner`. |
| `terraform init`: connection refused on `host.docker.internal:9000` | MinIO is not running. The "Ensure state backend" step creates it; check that step's log. |
| `mc … Access Denied` in "Ensure state backend" | `TFSTATE_*` secrets missing for this environment (the log shows them blank) or different from the values MinIO was created with. |
| `unable to pull image … unauthorized` | GHCR packages still private — see [Make the images public](#make-the-images-public-one-time). |
| `unable to pull image … not found` | That tag was never built. Run the workflow manually (**Run workflow**) on that branch. |
| `qemu: uncaught target signal 4 (Illegal instruction)` during build | Node running under emulation; keep `--platform=$BUILDPLATFORM` on Node stages. |
| Trivy fails the build with HIGH/CRITICAL findings | Base image packages are outdated. Update the base image tag in the Dockerfile; the runtime stages already run `apk upgrade`. |
| Integration test: `POST /api/scores` 400 | Payload violates validation (100–200 points per correct answer). |
| Release job fails with "Set exactly one label" | The merged PR had no or several `release:*` labels. Add one and re-run, or create the tag and release manually. |
| `Resource not accessible by integration` in CodeQL | The workflow needs `actions: read`; on a private repo CodeQL also needs Advanced Security. |
| `CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled` | Disable code scanning default setup (Step 4.6). |
| Containers run as `amd64` on Apple Silicon | Old single-arch images; rebuild so the `:<sha>`/`:<branch>` tag is multi-arch. |
