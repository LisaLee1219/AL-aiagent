# Production image for GitHub Container Registry (GHCR) deployments
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV COZE_PROJECT_ENV=PROD
RUN pnpm next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV COZE_PROJECT_ENV=PROD
ENV PORT=5001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 5001

# Next.js standalone server (no custom server.ts — works with API routes on GitHub/Docker hosts)
CMD ["node", "server.js"]
