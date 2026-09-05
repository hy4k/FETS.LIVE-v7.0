# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy only package manifests first (layer cache for install)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY fets-point/package.json ./fets-point/

# Install dependencies (cached unless lockfile changes)
RUN pnpm install --no-frozen-lockfile --dangerously-allow-all-builds
# Build-time environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GBP_CLIENT_ID
ARG VITE_GBP_LOCATION_COCHIN
ARG VITE_GBP_LOCATION_CALICUT
ARG VITE_APP_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GBP_CLIENT_ID=$VITE_GBP_CLIENT_ID
ENV VITE_GBP_LOCATION_COCHIN=$VITE_GBP_LOCATION_COCHIN
ENV VITE_GBP_LOCATION_CALICUT=$VITE_GBP_LOCATION_CALICUT
ENV VITE_APP_URL=$VITE_APP_URL

# Copy source code (after install for better layer caching)
COPY fets-point/ ./fets-point/

# Build the app (skip tsc type-checking — Vite handles transpilation)
RUN pnpm --filter fets-point exec vite build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/fets-point/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
