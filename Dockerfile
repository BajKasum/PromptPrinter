# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Multi-stage build for Next.js standalone output.
# Final image runs `node server.js` on port 3000 as a non-root user.
# ──────────────────────────────────────────────────────────────────────────────

# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
# Der Cache liegt außerhalb der Image-Schichten: eine geänderte Abhängigkeit lädt nur
# die Pakete neu, die sich geändert haben, nicht alle.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ─── dev ─────────────────────────────────────────────────────────────────────
# Ziel des Dev-Stacks (docker-compose.yml). Übernimmt node_modules aus `deps`, dort
# ohne NODE_ENV installiert und deshalb mit den devDependencies, die `next dev` braucht.
# Kein `COPY . .`: Compose legt den Quellbaum beim Start per Bind-Mount über /app.
FROM deps AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# -H 0.0.0.0: sonst erreicht die Portfreigabe den Server im Container nicht.
#
# `dev:docker` (webpack) statt `dev` (Turbopack): Turbopack bemerkt Änderungen über einen
# Bind-Mount von Windows nicht, auch nicht mit Polling.
#
# `npm install` beim Start: das benannte Volume für node_modules wird nur beim ersten
# Einhängen aus dem Image befüllt und bliebe sonst nach einem Neubau veraltet. Stimmt es
# schon mit dem Lockfile überein, tut der Befehl fast nichts, anders als `npm ci`.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev:docker -- -H 0.0.0.0"]

# ─── builder ─────────────────────────────────────────────────────────────────
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder
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
# Der Build-Cache von Next liegt außerhalb der Image-Schichten und kommt nicht ins
# Laufzeit-Image; er beschleunigt nur diesen Schritt.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runner
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
