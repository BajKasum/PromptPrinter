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
