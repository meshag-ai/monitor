# Stage 1: Install dependencies
FROM node:20-alpine AS dependencies

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Stage 2: Build the application
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json

# Copy source files needed for temporal worker
COPY temporal ./temporal
COPY lib ./lib
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma client
RUN pnpm prisma:generate

# Build the temporal worker
# The worker uses tsx to run TypeScript directly, but we'll prepare the environment
RUN pnpm install tsx

# Stage 3: Production image
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./
RUN pnpm install --prod

# Install tsx for running TypeScript (needed for worker)
RUN pnpm add tsx

# Copy built artifacts and source files
COPY --from=builder /app/temporal ./temporal
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S temporal -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R temporal:nodejs /app

# Switch to non-root user
USER temporal

# Set environment variables
ENV NODE_ENV=production

# Run the temporal worker
CMD ["pnpm", "temporal:worker"]
