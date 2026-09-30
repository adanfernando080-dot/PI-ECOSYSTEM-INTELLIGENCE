# syntax=docker/dockerfile:1.7
# Pi Ecosystem Intelligence — API / workers image.
# The same image runs the API (default), migrations, seed and workers.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY packages/scoring/package.json packages/scoring/
COPY packages/confidence/package.json packages/confidence/
COPY packages/ranking/package.json packages/ranking/
COPY packages/validation/package.json packages/validation/
COPY packages/metrics/package.json packages/metrics/
COPY integrations/pi/package.json integrations/pi/
COPY apps/api/package.json apps/api/
COPY workers/metrics/package.json workers/metrics/
COPY workers/rankings/package.json workers/rankings/
COPY workers/anomalies/package.json workers/anomalies/
COPY workers/blockchain-sync/package.json workers/blockchain-sync/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM deps AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN useradd --system --uid 10001 pi && chown -R pi /app
USER pi
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "apps/api/src/server.ts"]
