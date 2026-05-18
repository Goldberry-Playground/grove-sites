ARG AGENT_UID=1001
ARG AGENT_GID=1001

FROM node:22-bookworm-slim

RUN userdel -r node 2>/dev/null || true

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      ca-certificates \
      gh \
      openssh-client \
      jq \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

RUN npm install -g @anthropic-ai/claude-code

RUN groupadd -g ${AGENT_GID} agent \
 && useradd -m -u ${AGENT_UID} -g ${AGENT_GID} -s /bin/bash agent

USER agent
WORKDIR /home/agent/repo

ENV PNPM_HOME=/home/agent/.local/share/pnpm \
    PATH=/home/agent/.local/share/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true

RUN git config --global commit.gpgsign false \
 && git config --global user.email "sandcastle-agent@goldberrygrove.farm" \
 && git config --global user.name "Sandcastle Agent"
