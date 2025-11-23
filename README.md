# MeshAG

MeshAG is an intelligent database performance monitoring and optimization platform that helps developers and DBAs monitor, analyze, and optimize their database performance using AI-powered insights.

## What is MeshAG?

MeshAG automatically monitors your PostgreSQL and MySQL databases, collects performance metrics, identifies slow queries, and provides AI-powered optimization suggestions. It runs background jobs using Temporal.io to continuously analyze your database performance and generate actionable recommendations.

### Key Features

- 🔌 **Multi-Database Support**: Connect to PostgreSQL and MySQL databases
- 📊 **Performance Monitoring**: Automatic collection of query statistics, execution times, and resource usage
- 🐌 **Slow Query Detection**: Identifies and tracks slow-running queries
- 🤖 **AI-Powered Suggestions**: Uses GPT-4 to generate optimization recommendations for indexes, queries, and schema
- 📈 **Analytics Dashboard**: Visualize query performance, index usage, and table access patterns
- 🔒 **Secure Credentials**: Encrypted storage of database credentials
- 🌐 **Proxy Support**: Optional SOCKS5 proxy for database connections
- ⚡ **Background Processing**: Temporal.io workflows for reliable, scalable background jobs

## Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Database**: PostgreSQL (application database)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Background Jobs**: [Temporal.io](https://temporal.io/)
- **Authentication**: [Clerk](https://clerk.com/)
- **AI**: OpenAI GPT-4
- **UI**: [Tailwind CSS](https://tailwindcss.com/), Radix UI, Framer Motion
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (for application data)
- Temporal Cloud account or self-hosted Temporal server
- Clerk account for authentication
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meshag
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   - `DATABASE_URL`: PostgreSQL connection URL for application data
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
   - `CLERK_SECRET_KEY`: Clerk secret key
   - `WEBHOOK_SECRET`: Clerk webhook secret
   - `ENCRYPTION_KEY`: Key for encrypting database credentials (generate with `openssl rand -hex 32`)
   - `TEMPORAL_ADDRESS`: Temporal server address
   - `TEMPORAL_NAMESPACE`: Temporal namespace
   - `TEMPORAL_TASK_QUEUE`: Temporal task queue name
   - `TEMPORAL_API_KEY`: Temporal API key (for Temporal Cloud)
   - `OPENAI_API_KEY`: OpenAI API key for generating suggestions
   - `PROXY_URL` (optional): SOCKS5 proxy URL for database connections

4. **Run database migrations**
   ```bash
   pnpm prisma:migrate
   ```

5. **Generate Prisma client**
   ```bash
   pnpm prisma:generate
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

7. **Start the Temporal worker** (in a separate terminal)
   ```bash
   pnpm temporal:worker
   ```

## Production Deployment

MeshAG consists of two components that need to be deployed:

### 1. Next.js Application

The Next.js application can be deployed to any platform that supports Node.js applications.

#### Deploy to Vercel (Recommended)

1. Push your code to GitHub, GitLab, or Bitbucket
2. Import the project in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy!

#### Deploy to Other Platforms

Build the application:
```bash
pnpm build
```

Start the production server:
```bash
pnpm start
```

The application will run on port 3000 by default.

### 2. Temporal Worker

The Temporal worker must run continuously to process background jobs. It's packaged as a Docker container for easy deployment.

#### Using Docker (Recommended)

1. **Build the Docker image locally**:
   ```bash
   docker build -t meshag-temporal-worker:latest .
   ```

2. **Create a production environment file** (`.env.production`):
   ```env
   TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233
   TEMPORAL_API_KEY=your-api-key
   TEMPORAL_TASK_QUEUE=meshag-tasks
   TEMPORAL_NAMESPACE=default
   DATABASE_URL=postgresql://user:pass@host:5432/db
   ENCRYPTION_KEY=your-encryption-key
   OPENAI_API_KEY=sk-...
   ```

3. **Run the container**:
   ```bash
   docker run -d \
     --name meshag-worker \
     --env-file .env.production \
     --restart unless-stopped \
     meshag-temporal-worker:latest
   ```

#### Using GitHub Container Registry

The project includes a GitHub Actions workflow that automatically builds and publishes Docker images to GitHub Container Registry (ghcr.io).

1. **Enable GitHub Actions** in your repository

2. **The workflow triggers on**:
   - Push to main branch (affecting temporal/, lib/, prisma/, or Dockerfile)
   - Manual dispatch from Actions tab

3. **Pull the published image**:
   ```bash
   docker pull ghcr.io/<your-username>/meshag/temporal-worker:latest
   ```

4. **Run the published image**:
   ```bash
   docker run -d \
     --name meshag-worker \
     --env-file .env.production \
     --restart unless-stopped \
     ghcr.io/<your-username>/meshag/temporal-worker:latest
   ```

#### Deploy to Cloud Platforms

**AWS ECS/Fargate**:
- Push the Docker image to AWS ECR
- Create an ECS task definition with environment variables
- Run as a Fargate service

**Google Cloud Run**:
- Push the Docker image to Google Container Registry
- Deploy as a Cloud Run service with environment variables

**Kubernetes**:
- Deploy using a Deployment with the Docker image
- Store secrets in Kubernetes Secrets or ConfigMaps

See [DOCKER.md](./DOCKER.md) for detailed Docker deployment instructions.

## Architecture

For developers and AI agents working with the codebase, see [CRUSOR.md](./CRUSOR.md) for comprehensive documentation on:
- Application architecture and structure
- Database schema and models
- Temporal workflows and activities
- API routes and endpoints

## License

MeshAG is dual-licensed:

- **AGPLv3**: Free for open-source and personal use
- **Commercial License**: Required for proprietary/SaaS use without source disclosure

See [LICENSE_DUAL.md](./LICENSE_DUAL.md) for details.

For commercial licensing inquiries, contact: [abhishek@meshag.sh](mailto:abhishek@meshag.sh)

## Contributing

Contributions are welcome! Please ensure you follow the AGPLv3 license requirements.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
