# Build stage
FROM node:22-bookworm-slim AS builder
WORKDIR /app/apps/console

ARG PREVIEW_STUB
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    PREVIEW_STUB=${PREVIEW_STUB}

COPY package*.json ./
# NPM 安全与稳定性增强：配置官方 registry 与超时/重试
RUN npm config set registry https://registry.npmjs.org \
 && npm config set fetch-retry-maxtimeout 600000 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retries 5 \
  && npm config set legacy-peer-deps true \
  && npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY ./ ./
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app/apps/console
ENV CI=true NEXT_TELEMETRY_DISABLED=1 NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org \
 && npm config set fetch-retry-maxtimeout 600000 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retries 5 \
  && npm config set legacy-peer-deps true \
  && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/console/.next/standalone ./
COPY --from=builder /app/apps/console/.next/static ./.next/static
COPY --from=builder /app/apps/console/public ./public
COPY --from=prod-deps /app/apps/console/node_modules ./node_modules

EXPOSE 8080
CMD ["node","server.js"]
