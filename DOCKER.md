# Temporal Worker Docker Setup

This directory contains the Dockerized temporal worker for the Plotweft application.

## Building the Docker Image

### Local Build

```bash
docker build -t temporal-worker:latest .
```

### Build with specific tag

```bash
docker build -t temporal-worker:v1.0.0 .
```

## Running the Docker Container

### Required Environment Variables

The temporal worker requires the following environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TEMPORAL_ADDRESS` | Temporal server address | Yes | `your-namespace.tmprl.cloud:7233` |
| `TEMPORAL_API_KEY` | API key for Temporal Cloud | No* | `your-api-key` |
| `TEMPORAL_CLIENT_CERT` | Client certificate for mTLS | No* | `-----BEGIN CERTIFICATE-----...` |
| `TEMPORAL_CLIENT_KEY` | Client private key for mTLS | No* | `-----BEGIN PRIVATE KEY-----...` |
| `TEMPORAL_TASK_QUEUE` | Task queue name | Yes | `plotweft-tasks` |
| `TEMPORAL_NAMESPACE` | Temporal namespace | No | `default` |
| `DATABASE_URL` | PostgreSQL connection URL for Prisma | Yes | `postgresql://user:pass@host:5432/db` |
| `ENCRYPTION_KEY` | Encryption key for credentials | Yes | `your-encryption-key` |
| `OPENAI_API_KEY` | OpenAI API key for LLM suggestions | Yes | `sk-...` |

*Either `TEMPORAL_API_KEY` or both `TEMPORAL_CLIENT_CERT` and `TEMPORAL_CLIENT_KEY` are required for authentication.

### Run Container

```bash
docker run --rm \
  -e TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233 \
  -e TEMPORAL_API_KEY=your-api-key \
  -e TEMPORAL_TASK_QUEUE=plotweft-tasks \
  -e TEMPORAL_NAMESPACE=default \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e ENCRYPTION_KEY=your-encryption-key \
  -e OPENAI_API_KEY=sk-... \
  temporal-worker:latest
```

### Using Environment File

Create a `.env.production` file with your environment variables:

```env
TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233
TEMPORAL_API_KEY=your-api-key
TEMPORAL_TASK_QUEUE=plotweft-tasks
TEMPORAL_NAMESPACE=default
DATABASE_URL=postgresql://user:pass@host:5432/db
ENCRYPTION_KEY=your-encryption-key
OPENAI_API_KEY=sk-...
```

Then run:

```bash
docker run --rm --env-file .env.production temporal-worker:latest
```

## GitHub Actions Workflow

The GitHub Actions workflow automatically builds and publishes Docker images to GitHub Container Registry (ghcr.io).

### Workflow Triggers

- **Push to main branch**: When changes are made to:
  - `temporal/**`
  - `lib/**`
  - `prisma/**`
  - `Dockerfile`
  - `.github/workflows/docker-publish.yml`
  
- **Manual dispatch**: Can be triggered manually from the Actions tab

### Image Tags

Images are tagged with:
- `latest` - Most recent build from main branch
- `main-<git-sha>` - Specific commit from main branch
- `<branch-name>` - Current branch name

### Pulling Published Images

```bash
# Pull the latest image
docker pull ghcr.io/<your-username>/plotweft/temporal-worker:latest

# Pull a specific version
docker pull ghcr.io/<your-username>/plotweft/temporal-worker:main-abc1234
```

### Running Published Images

```bash
docker run --rm \
  --env-file .env.production \
  ghcr.io/<your-username>/plotweft/temporal-worker:latest
```

## Multi-Platform Support

The Docker image is built for multiple platforms:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/Apple Silicon)

This ensures the image can run on various cloud providers and local development machines.

## Image Optimization

The Dockerfile uses a multi-stage build to minimize the final image size:

1. **Dependencies stage**: Installs all dependencies
2. **Builder stage**: Builds the application and generates Prisma client
3. **Production stage**: Contains only production dependencies and built artifacts

## Security

- The container runs as a non-root user (`temporal:nodejs`)
- Only necessary files are copied to the final image
- Sensitive files are excluded via `.dockerignore`
