# Container image for the Discord interactions endpoint (server.ts).
#
# Zero runtime dependencies: server.ts and everything under lib/ are pure
# node:http / node:crypto / fetch, so there is no `npm install` step. Node 24
# strips TypeScript types natively, so `node server.ts` runs the source directly
# (this is the package.json `start` script minus the now-default
# --experimental-strip-types flag).
#
# Deployed as a DigitalOcean App Platform service — see infra/do/discord-bridge.yaml.
# The build context is the monorepo root (spec `source_dir: /`); this file is
# referenced via `dockerfile_path: apps/discord-bridge/Dockerfile`.
FROM node:24-alpine

# Run as the built-in non-root `node` user. The service only reads its own
# source and writes audit records to stdout — it needs no filesystem writes.
WORKDIR /app
COPY --chown=node:node apps/discord-bridge ./
USER node

ENV NODE_ENV=production

# server.ts listens on process.env.PORT (default 8787). App Platform injects
# PORT to match the spec's http_port; EXPOSE is documentation only.
EXPOSE 8787

CMD ["node", "server.ts"]
