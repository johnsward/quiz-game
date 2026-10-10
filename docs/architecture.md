# Architecture

This document explains how the quiz game gets from a commit to a running container,
and, more importantly, why it is built the way it is. If you only want to set it up,
read [infra/README.md](../infra/README.md). Come back here when you want to know
why a piece exists or whether you can change it.

## The goal

The app is small: a React frontend served by nginx, a Node API, and a Postgres
database. The aim was to
have a realistic dev → test → prod flow with automated checks, approvals and
releases, but running entirely on one machine. Many of the
choices below are about getting real-world habits without real-world infrastructure.

## The big picture

```
 pull request ──► CI           lint, types, tests, build, migration check, secrets, dependency review, image scan
              ├► Security      CodeQL, secret scan, dependency audit
              └► Release check is there a release label? (PRs into main)

 push to dev / test / main
        │
        ▼
   Deploy workflow
     1. build   (GitHub's servers)   build images for what changed, push to GHCR
     2. deploy  (your machine)       Terraform creates or updates the containers,
                                     then a smoke test checks they actually work

 push to main also ──► Release workflow   tag + GitHub release

 On the machine, per environment (dev / test / prod):

   browser ─► frontend (nginx) ──/api──► backend (Node) ──► db (Postgres + volume)
              the only published port     internal only      internal only
```

Everything on the bottom half exists three times, once per environment, side by
side on the same Docker daemon: `quiz-dev-*`, `quiz-test-*` and `quiz-prod-*`.
They differ only in their name and the host port the frontend is published on
(8081, 8082 and 8080 by default, set in each `.tfvars` file; the other tunable values
have defaults in `infra/variables.tf`).

## Choices and the reasons behind them

### Branches map to environments

`dev`, `test` and `main` each deploy to their own environment: `dev` to dev, `test` to
test and `main` to prod. The rule is simple: the code in a branch is what runs in its
environment. Every push to a branch redeploys the matching environment, so you can
always tell what is running by looking at the branch.

This mapping also gives each stage a natural place to hang rules: `prod` needs a human
to approve, `test` runs an extra integration test. The trade-off is that the
environments are only as consistent as their branches. If the branches differ, the
environments differ, so how code moves between the branches has to be agreed by the
team; the pipeline does not enforce it.

### Terraform and Docker instead of a script

The environments are described with Terraform using the Docker provider. A shell
script could start three containers, but Terraform gives something a script does not:
it knows what it created last time. Re-running it changes only what differs, and
`terraform destroy` removes exactly what was created, nothing more.

There is one Terraform configuration shared by all environments. The three
containers (db, backend, frontend) are described once, in a single map, and one
module creates each of them. Environments differ only through a small `.tfvars` file
(name and port), plus secrets and image tags passed in at deploy time. Adding a fourth
environment means adding one small file, not copying a directory. This was a
deliberate answer to the usual "dev/test/prod folders that slowly diverge" problem.

### State in MinIO

Terraform has to store its state somewhere. A state file on disk only works from one
machine, and it would not be available to a CI job running in a container. MinIO is a
service that speaks the S3 protocol, so the state does not depend on the storage of a
single machine: any environment, on any machine, can reach it over the network and
read and write the same state. Terraform's normal S3 backend works against it,
including state locking, which stops two deployments from changing the same
environment at once. Each environment gets its own state key, so a problem in `dev`
cannot corrupt the state of `prod`.

The deploy workflow starts MinIO itself the first time it runs, so there is no manual
bootstrap step to forget.

### GitHub Actions with a self-hosted runner

CI, security scans and image builds all run on GitHub's own servers, where they are
fast to set up and free of side effects. The deploy step is different: it has to
reach the Docker daemon on your machine, and GitHub's servers cannot do that. So that
one job runs on a runner you host.

The runner is itself a container. That keeps the setup reproducible (one
`docker compose up`, no tools installed on the host) but it creates a subtle problem
worth understanding. The runner controls the host's Docker through the mounted socket,
which means any path it gives Docker is resolved on the host, not inside the runner.
The fix is to mount the runner's working directory at the same absolute path on both
sides, so a path means the same thing everywhere. Without this, bind mounts silently
point at the wrong place.

This is also the biggest security decision in the project. Access to the Docker socket
is effectively root on the host. So the runner is only ever used by the deploy job,
which only triggers on pushes to the three protected branches, never on pull requests.
Anyone who can push there can run code on your machine.

### Building images once, in the cloud, for both architectures

Images are built on GitHub's servers and pushed to GHCR, tagged with the commit SHA.
A SHA tag never changes, so you can always say exactly what is running and roll back
by redeploying an old tag.

Each image is published for both `amd64` and `arm64`, and Docker picks the right one
for the machine pulling it. This matters because GitHub's builders are Intel while
many laptops are Apple Silicon, and running the wrong architecture means slow
emulation. Building arm64 on an Intel builder has its own trap: Node 22 crashes under
QEMU emulation. The Dockerfiles avoid it by running the Node build steps on the
builder's native architecture; the output (static files, plain JavaScript) is
identical either way, so only the final runtime layer is made per architecture.

Images are stored on GHCR and made public. Terraform pulls them through the local
Docker daemon, which has no registry login, so private images would fail to pull.
Nothing secret is inside an image: passwords are injected when the container starts.

### Only build what changed, reuse the rest

Rebuilding both services on every push wastes minutes and also produces new image
versions for code that did not change. So the build step builds a service only if
its files changed. For anything unchanged, the deploy step reuses what is available:

1. an image built in this run, if there is one;
2. otherwise whatever is already running for that service;
3. otherwise the latest build for that branch (every build also moves a
   `:<branch>` tag, which exists exactly for this case, for example right after an
   environment has been torn down).

The cost of this design is that frontend and backend are promoted independently, so
they must stay compatible with each other across versions. That is a real constraint
on how you change the API. The benefit is that a one-line frontend fix does not
touch the backend or the database at all.

One thing to be aware of: a promotion from `dev` to `test` rebuilds from the same
source rather than moving the exact image that was tested. True "build once,
promote the same artifact" would retag the existing image instead. It was left out to
keep the first version simple, and it is the most obvious next improvement.

### Checks before and after merging

Before merging, pull requests run CI on only the parts they touch (a change in
`frontend/` does not run backend tests): lint with oxlint, type checks, unit tests and
a production build. The backend tests run against a real Postgres service. When a pull
request changes database migrations, an extra job checks that released migrations are
not edited, then applies the new migrations and runs the previous release's tests
against the new schema, so the old backend keeps working during a rollout. Every pull
request is also scanned for committed secrets (gitleaks, only the commits of that pull
request) and checked for newly introduced vulnerable dependencies (dependency review).
Changed services get their image built and scanned with Trivy, which fails on high or
critical vulnerabilities. A single aggregate check, `ci-ok`, summarises everything, which
is the one thing branch protection has to require. A separate Security workflow runs
CodeQL, a full secret scan and an npm audit on pushes and pull requests, and also weekly
because new vulnerabilities appear even when your code does not change.

After a deploy, a smoke test calls the health endpoints and the leaderboard through
the real frontend port. On `test` there is also an integration test that submits a
score and reads it back through nginx, the API and the database. A deploy only
counts as successful once that has passed, which is why a container that starts but
cannot reach its database still fails the run.

### Secrets stay out of the repository

The only secrets are the MinIO credentials and the database password, and they live
in GitHub Secrets. They reach Terraform as environment variables for a single job.
Only the frontend publishes a port, and only on `127.0.0.1`, so nothing is reachable
from other machines. The backend and database are reachable only from inside their
environment's Docker network, under a name like `db`, which is also why the three
environments cannot talk to each other.

### Releases are decided by a label

Semantic versioning needs a human decision (is this change a patch, a feature or a
breaking change?), and a pull request label is the lightest place to put it. A
`release:major`, `release:minor` or `release:patch` label on the pull request into
`main` decides the next version, which is computed from the latest tag. The release is
created the moment the merge lands, without waiting for the production approval: a
release marks what was merged, while the deployment is a separate event with its own
gate. The PR check that reports a missing label is advisory on purpose; it informs
rather than blocks.

## What this does not do

Being clear about the limits matters more than hiding them:

- **No isolation between environments.** All three share one machine and one Docker
  daemon. A runaway `dev` container can starve `prod`. This is a learning setup, not
  a production one.
- **No high availability.** There is one instance of everything. A deploy replaces a
  container, so there is a short gap, not a zero-downtime rollout.
- **No TLS, load balancing or managed database.** Postgres is a container with a
  volume, and nothing backs it up.
- **One MinIO instance.** The state is not tied to the machine that runs the
  environments, but it is still a single service without backups or redundancy.
- **The runner is powerful.** It is root-equivalent on the host, and the pipeline's
  safety rests on the three branches being protected.
- **Tested on macOS and Windows with Docker Desktop.** Linux needs a few adjustments
  and is untested; both are covered in the deployment guide.

## If you wanted to take it further

In rough order of value: promote the same image instead of rebuilding per branch;
back up the Postgres volume and MinIO; add a rollback workflow that redeploys the
previous tag; and replace the shared host with separate machines or a cluster, at
which point the Terraform structure carries over largely unchanged because the
environment definition is already separate from where it runs.
