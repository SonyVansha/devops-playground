# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
ARG BASE_PATH=""
ENV NEXT_TELEMETRY_DISABLED=1 BASE_PATH=${BASE_PATH}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime: distroless (tanpa shell, tanpa package manager) -> permukaan CVE minimal
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_MANUAL_SIG_HANDLE=true PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=65532:65532 /app/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/.next/static ./.next/static
USER 65532:65532
EXPOSE 3000
CMD ["server.js"]
