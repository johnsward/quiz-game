# ---- Build: compile TypeScript ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Production dependencies (pure JS: express, pg, ... -- no native addons) ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runtime: production dependencies + compiled output only ----
FROM node:22-alpine
ENV NODE_ENV=production
# The runtime only needs `node`; drop the npm/corepack bundled in the base image
# (their vendored packages are the source of most image CVEs).
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/server.js"]
