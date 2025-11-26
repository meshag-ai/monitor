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

- Bun 1.0+
- PostgreSQL database (for application data)
- Temporal Cloud account or self-hosted Temporal server
- Clerk account for authentication
- OpenAI API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meshag
   ```

2. **Install dependencies**
   ```bash
   bun install
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
   bun run prisma:migrate
   ```

5. **Generate Prisma client**
   ```bash
   bun run prisma:generate
   ```

6. **Start the development server**
   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

7. **Start the Temporal worker** (in a separate terminal)
   ```bash
   bun run temporal:worker
   ```

## Production Deployment

MeshAG is designed to be deployed using Docker. We provide pre-built images for both the web application and the Temporal worker.

### Using Docker Compose (Recommended)

The easiest way to run MeshAG in production is using Docker Compose. This will spin up the Next.js application, the Temporal worker, and optionally a local Temporal server and PostgreSQL database if needed.

1. **Configure Environment**
   
   Ensure your `.env` file is populated with production values.

2. **Run with Docker Compose**

   If you want to use the pre-built images from our registry:

   ```bash
   # Set your GitHub username to pull the correct images
   docker-compose up -d
   ```

   This will start:
   - **app**: The Next.js web application (port 3000)
   - **worker**: The Temporal worker for background tasks
   - **postgres**: A local PostgreSQL instance (if DATABASE_URL is not provided)
   - **temporal-server**: A local Temporal dev server (for testing/self-hosted)

### Manual Docker Deployment

You can also run the containers individually.

**Web Application:**
```bash
docker run -d \
  --name meshag-app \
  -p 3000:3000 \
  --env-file .env.production \
  ghcr.io/meshag-ai/monitor/monitor:latest
```

**Temporal Worker:**
```bash
docker run -d \
  --name meshag-worker \
  --env-file .env.production \
  ghcr.io/meshag-ai/monitor/worker:latest
```

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
