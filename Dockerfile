# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client & build Next.js standalone application
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy essential standalone assets, static CSS/JS chunks & public files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/public ./.next/standalone/public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/standalone/.next/static

# Ensure persistent uploads directory permissions
RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads /app/prisma /app/.next

USER nextjs

EXPOSE 3000

# Start server with robust DB migration retry loop and exit 1 failure guard
CMD ["sh", "-c", "for i in 1 2 3 4 5; do if npx prisma migrate deploy; then break; fi; if [ \"$i\" -eq 5 ]; then echo \"Database migration failed after 5 attempts\"; exit 1; fi; sleep 3; done; exec node .next/standalone/server.js"]
