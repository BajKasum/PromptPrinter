# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Multi-stage build for Next.js 15 standalone output.
# Final image runs `node server.js` on port 3000 as a non-root user.
# ──────────────────────────────────────────────────────────────────────────────

# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
# Cache mount for npm's package cache (~/.npm), NOT baked into any image layer —
# BuildKit persists it across separate `docker build` invocations independently
# of the layer cache above it. Without this, every real dependency change
# (which invalidates the COPY above and therefore this RUN) forced a full
# re-download of all ~700 packages from the npm registry with zero reuse, even
# though most of them hadn't changed. Measured on this project: 278s for a
# from-scratch `npm ci` inside the container vs. 78s for the identical install
# on the host with a warm npm cache — the gap is exactly the cost of always
# hitting the network instead of a local cache. With the mount, only packages
# that actually changed since the last build need to be fetched.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ─── dev ─────────────────────────────────────────────────────────────────────
# Target for docker-compose.yml (the default dev stack — plain `docker compose
# up --build` builds and runs THIS stage, not `runner`). Reuses `deps`'
# already-cache-mounted `npm ci` output as-is: that install has no NODE_ENV set
# when it runs, so it includes devDependencies (typescript among them, which
# `next dev` needs), unlike `builder`/`runner` below which are production-only.
#
# Deliberately no `COPY . .` here. docker-compose.yml bind-mounts the real
# source tree over /app at container start for hot reload, so anything copied
# in at build time would be immediately shadowed — copying it would only slow
# down every `--build` for no benefit. What IS worth baking in at build time is
# node_modules, which is what makes `--build` a real, useful step here rather
# than pure ceremony: a fresh dependency install is cached exactly like the
# production path's, and the compose file's own `node_modules` named volume
# (see its comment) keeps this stage's Alpine/musl-built node_modules from
# being shadowed by whatever the bind mount would otherwise put there.
FROM deps AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# -H 0.0.0.0: the dev server must listen on all interfaces, not just
# localhost, or the host-side port mapping can't reach it inside the
# container.
#
# `npm run dev:docker` (plain `next dev`, webpack), NOT `npm run dev`
# (`next dev --turbopack`, what the host uses) — also found the hard way.
# Turbopack compiles and serves pages fine in the container, but never once
# picked up a host-side file edit through the bind mount: confirmed the bind
# mount itself delivers changes correctly (`docker exec ... cat` showed the
# new content immediately), confirmed WATCHPACK_POLLING/CHOKIDAR_USEPOLLING
# (webpack/chokidar-only, Turbopack doesn't read them) predictably did
# nothing, and then confirmed that even Next's own stable, bundler-agnostic
# `watchOptions.pollIntervalMs` (next.config.ts) made no difference either —
# a real edit followed by a fresh request still served the stale compiled
# output in ~400ms with no "Compiling ..." log line, where a genuine
# recompile takes 20-30s+ on this project. Turbopack's file watching does not
# currently work over a Windows Docker Desktop bind mount, full stop; this
# isn't a config gap left to find. Webpack + the same polling env vars is the
# proven-working mechanism the project's original dev-compose already relied
# on before Turbopack existed, confirmed working again below with the same
# edit-then-request test. The host's `npm run dev` keeps Turbopack — no
# virtualized bind-mount boundary there, nothing to work around.
#
# `npm install` before `next dev:docker`, not just the image's own baked-in
# node_modules from the build above — found the hard way, by actually running
# this: docker-compose.yml's node_modules NAMED VOLUME only gets seeded from
# the image on its FIRST-EVER mount. A volume created months ago by an earlier
# setup (or just an earlier version of this same file) already has content, so
# Docker never re-populates it from a fresh build, ever — `--build` silently
# stopped mattering for node_modules the moment that volume was created, and a
# rebuilt image's dependencies were never actually reaching the running
# container. Caught by comparing what the container reported at boot
# (Next.js 15.1.6, from a volume dated back to this project's original setup)
# against what the image had just been built with (15.5.22, matching
# package-lock.json exactly).
#
# `npm install`, not `npm ci`: unlike `npm ci` (always deletes and reinstalls
# everything), `npm install` diffs against what's already there and is a fast
# near no-op on the common path where the volume already matches
# package-lock.json — it only does real work on the same two occasions a
# rebuild would anyway: a genuinely stale/empty volume, or an actual
# dependency change. The build-time `npm ci` above still matters: it's what
# makes the very first `--build` (empty volume) fast via the cache mount
# rather than a cold network install inside the running container.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev:docker -- -H 0.0.0.0"]

# ─── builder ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
# Pass them via --build-arg if you want non-default values baked in.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cache mount for Next.js's own incremental build cache (SWC/webpack module
# cache). Measured on this project: an immediate second `npm run build` with a
# warm .next/cache and zero source changes took 56s vs. 85s cold — a ~34%
# reduction from cache reuse alone. The `builder` stage starts from a fresh
# filesystem on every single `docker build`, so without this mount every build
# paid the full cold-compile cost every time, even for a one-line source
# change, with no way to ever benefit from a previous build's work. The cache
# mount is never copied into the runner stage below (only .next/standalone and
# .next/static are), so this has no effect on the final image's size or
# contents — it only speeds up this RUN step.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output bundles only what's needed: server.js + minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static      ./.next/static

USER nextjs

EXPOSE 3000

# server.js is emitted by Next.js into the standalone output
CMD ["node", "server.js"]
