#!/usr/bin/env bash
#
# entrypoint.sh
#
# Runs as root at container start. Responsible for:
#   1. Aligning a "docker" group inside the container with the GID that
#      owns the mounted /var/run/docker.sock on the HOST, so the
#      unprivileged "runner" user can use `docker` without being root.
#   2. Installing the actions-runner binary into RUNNER_WORK_DIR on first
#      start (RUNNER_WORK_DIR is a path-aligned bind mount -- same
#      absolute path on the host and in this container -- so anything the
#      runner does under this directory, including where actions/checkout
#      places the repo, resolves to a real host path the Docker daemon
#      can bind-mount from during CD jobs).
#   3. Registering the runner against the target GitHub repository, if not
#      already registered (state persists in RUNNER_WORK_DIR).
#   4. Dropping to the "runner" user and starting run.sh.
#
# Required environment variables (see infra/runner/.env.example):
#   GITHUB_REPO_URL     e.g. https://github.com/<you>/cd-demo
#   GITHUB_RUNNER_TOKEN  a runner registration token (see
#                         infra/runner/.env.example for how to get
#                         one -- short-lived, generated per registration)
#   RUNNER_NAME          defaults to "quiz-runner"
#   RUNNER_WORK_DIR      absolute HOST path, bind-mounted into this
#                         container at the SAME path (critical for
#                         docker-outside-of-docker -- see
#                         infra/runner/docker-compose.yml)

set -euo pipefail

RUNNER_NAME="${RUNNER_NAME:-quiz-runner}"
: "${RUNNER_WORK_DIR:?RUNNER_WORK_DIR must be set to an absolute host path}"
RUNNER_VERSION="${RUNNER_VERSION:-2.319.1}"

# --- 1. Align docker group GID with the host socket ------------------------
if [ -S /var/run/docker.sock ]; then
    SOCK_GID="$(stat -c '%g' /var/run/docker.sock)"
    EXISTING_GROUP="$(getent group "$SOCK_GID" | cut -d: -f1 || true)"

    if [ -n "$EXISTING_GROUP" ]; then
        # A group with this GID already exists (e.g. GID 0 is always
        # "root" on Docker Desktop hosts where the socket is root-owned).
        # Reuse it instead of trying to create/rename a group onto an
        # already-taken GID, which would fail.
        usermod -aG "$EXISTING_GROUP" runner
        echo "[entrypoint] docker.sock is owned by GID ${SOCK_GID} (group '${EXISTING_GROUP}'); added runner to it"
    else
        groupadd -g "$SOCK_GID" docker
        usermod -aG docker runner
        echo "[entrypoint] created docker group with GID ${SOCK_GID} and added runner to it"
    fi
else
    echo "[entrypoint] WARNING: /var/run/docker.sock not found -- did you forget to mount it?" >&2
fi

mkdir -p "$RUNNER_WORK_DIR"
chown runner:runner "$RUNNER_WORK_DIR"
cd "$RUNNER_WORK_DIR"

# --- 2. Install the runner binary into RUNNER_WORK_DIR, if not present -----
if [ ! -f ./run.sh ]; then
    case "$(uname -m)" in
        x86_64)         RUNNER_ARCH="x64" ;;
        aarch64|arm64)  RUNNER_ARCH="arm64" ;;
        *)
            echo "[entrypoint] ERROR: unsupported architecture $(uname -m)" >&2
            exit 1
            ;;
    esac
    echo "[entrypoint] installing actions-runner v${RUNNER_VERSION} (${RUNNER_ARCH}) into ${RUNNER_WORK_DIR}"
    sudo -u runner curl -fsSL -o actions-runner.tar.gz \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
    sudo -u runner tar xzf actions-runner.tar.gz
    rm -f actions-runner.tar.gz
    ./bin/installdependencies.sh
    chown -R runner:runner "$RUNNER_WORK_DIR"
else
    echo "[entrypoint] actions-runner already installed in ${RUNNER_WORK_DIR}"
fi

# --- 3. Register the runner, if not already registered ---------------------
if [ ! -f .runner ]; then
    : "${GITHUB_REPO_URL:?GITHUB_REPO_URL must be set (e.g. https://github.com/you/quiz-game)}"
    : "${GITHUB_RUNNER_TOKEN:?GITHUB_RUNNER_TOKEN must be set -- see README.md}"

    echo "[entrypoint] registering runner '${RUNNER_NAME}' against ${GITHUB_REPO_URL}"
    sudo -u runner ./config.sh \
        --url "$GITHUB_REPO_URL" \
        --token "$GITHUB_RUNNER_TOKEN" \
        --name "$RUNNER_NAME" \
        --work "${RUNNER_WORK_DIR}/_work" \
        --labels "self-hosted,quiz-deploy" \
        --unattended \
        --replace
else
    echo "[entrypoint] runner already registered (found .runner); skipping registration"
fi

# --- 4. Run as the unprivileged "runner" user -------------------------------
exec sudo -u runner ./run.sh
