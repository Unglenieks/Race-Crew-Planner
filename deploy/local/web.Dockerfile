# Web image for local and fleet agent builds (not used by Railway).
FROM node:22-trixie-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_ENV=local
ARG NEXT_PUBLIC_RELEASE_SHA
# Next.js inlines NEXT_PUBLIC_* at build time. An empty Clerk key means the
# app runs without Clerk (signed-out only); unset it rather than pass "".
RUN if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then unset NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; fi; \
    pnpm build

ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "--filter", "@race-planner/web", "start"]
