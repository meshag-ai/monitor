# Stage 1: Install dependencies
FROM node:20-alpine AS dependencies

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source files needed for temporal worker
COPY temporal ./temporal
COPY lib ./lib
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma client
RUN pnpm prisma:generate

# Stage 3: Production image
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Copy prisma schema for client generation
COPY prisma ./prisma

# Install production dependencies and generate Prisma client
# We need to install all deps first to generate Prisma client, then prune
RUN pnpm install --frozen-lockfile && \
    pnpm prisma:generate && \
    pnpm install --prod --frozen-lockfile

# Install tsx for running TypeScript (needed for worker)
RUN pnpm add tsx

# Copy application source files
COPY temporal ./temporal
COPY lib ./lib
COPY tsconfig.json ./tsconfig.json

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S temporal -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R temporal:nodejs /app

# Switch to non-root user
USER temporal

# Set environment variables
ENV NODE_ENV=production

# Health check (optional - worker doesn't expose HTTP endpoint by default)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "process.exit(0)"

# Run the temporal worker
CMD ["pnpm", "temporal:worker"]
