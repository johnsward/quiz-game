# Self-hosted GitHub Actions runner, containerized.
#
# This runner drives the HOST's Docker daemon via a mounted
# /var/run/docker.sock (docker-outside-of-docker), so containers it starts
# (e.g. db, backend, frontend) are siblings of this container, not children.
#
# IMPORTANT (docker-outside-of-docker gotcha): because the runner talks to
# the host daemon, any bind-mount path the runner tells Docker to use (for
# example in deploy/docker-compose.yml) is resolved by the HOST, not by
# this container's filesystem. This is why PROJECT_ROOT must be an
# absolute HOST path (set at runner registration time / in .env), and why
# the repo checkout used by CI jobs must live at that same host path,
# bind-mounted into this container at the identical path. See
# the comments in infra/runner/docker-compose.yml.

FROM ubuntu:24.04

ARG RUNNER_VERSION=2.329.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        git \
        jq \
        unzip \
        python3 \
        python3-pip \
        python3-yaml \
        sudo \
        gnupg \
        lsb-release \
        libicu74 \
        libkrb5-3 \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*
# Node.js (the quiz game's backend/frontend are Node projects).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install the Docker CLI (client only -- we talk to the HOST daemon via the
# mounted socket, we do not run a daemon inside this container).
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for the runner, matching common self-hosted-runner
# convention, and add it to a "docker" group whose GID we'll align with the
# host's docker.sock group at container start (see entrypoint.sh) so it can
# actually use the mounted socket without needing full root.
RUN useradd -m -s /bin/bash runner \
    && usermod -aG sudo runner \
    && echo "runner ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# NOTE: the actual runner installation is NOT baked into the image here.
# RUNNER_WORK_DIR (a path-aligned bind mount, see infra/runner/docker-
# compose.yml) is empty on first start, so entrypoint.sh downloads and
# unpacks the runner binary into RUNNER_WORK_DIR itself at container start.
# This keeps the image path-agnostic and lets RUNNER_WORK_DIR be whatever
# host path the operator chooses.
ENV RUNNER_VERSION=${RUNNER_VERSION}

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Stay root at container start: entrypoint.sh aligns the docker group GID
# with the mounted host socket's GID, then drops privileges to the
# "runner" user itself before starting the actions-runner process.
ENTRYPOINT ["/entrypoint.sh"]
