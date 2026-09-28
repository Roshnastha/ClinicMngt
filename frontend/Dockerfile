# ---------------------------------------------------------------------------
# PhysioDesk frontend – Next.js 15 (standalone output for a small runtime image)
# ---------------------------------------------------------------------------

# --- deps + build stage -----------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (with dev deps needed for the build).
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Build with a placeholder API URL; the real value is injected at runtime
# (NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# docker-compose passes the same default used by the app's fallback).
COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
RUN npm run build

# --- runtime stage -----------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
