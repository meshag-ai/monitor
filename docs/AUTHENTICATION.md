# Basic Authentication Fallback

This application supports both Clerk authentication and a basic authentication fallback.

## Using Clerk (Recommended for Production)

To use Clerk authentication, set the following environment variables in your `.env` file:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
WEBHOOK_SECRET=your_webhook_secret
```

When these are set, users will be redirected to the Clerk-powered sign-in pages at `/sign-in` and `/sign-up`.

## Using Basic Authentication (Development/Fallback)

If Clerk keys are not configured, the application will automatically fall back to basic authentication.

### Setup

1. Ensure `JWT_SECRET` is set in your `.env` file:

```env
JWT_SECRET=your-secret-key-at-least-32-characters-long
```

If not set, a development secret will be used (not recommended for production).

2. Run database migrations to add the password fields:

```bash
pnpm prisma:migrate
```

3. Seed the database with demo users:

```bash
pnpm prisma:seed
```

4. Access the basic login page at `/basic-login`

### Demo Credentials

After running the seed script, the following demo users will be available:

- **Admin User**
  - Email: `admin@example.com`
  - Password: `admin123`

- **Demo User**
  - Email: `demo@example.com`
  - Password: `demo123`

### Creating New Users

To add more users, you can:

1. **Via Database**: Insert directly into the `User` table with a hashed password using bcrypt (salt rounds: 10)
2. **Via Seed Script**: Edit `prisma/seed.ts` to add more users
3. **Via API**: Use the `createUser()` function in `lib/auth.ts` to programmatically create users

Example creating a user programmatically:

```typescript
import { createUser } from "@/lib/auth";

const newUser = await createUser("user@example.com", "password123", "User Name");
```

### Security Notes

⚠️ **Important**: The basic authentication is intended as a fallback for development or when Clerk is not available. For production use:

1. Use Clerk or another robust authentication provider
2. Passwords are already hashed with bcrypt (salt rounds: 10)
3. Users are stored in the database via Prisma
4. Use strong JWT secrets (at least 32 characters)
5. Enable HTTPS in production
6. Consider adding rate limiting to login endpoints

## How It Works

The `middleware.ts` file checks if Clerk is configured:
- If Clerk keys are present → uses Clerk authentication
- If Clerk keys are missing → uses basic JWT authentication

The `app/providers.tsx` conditionally wraps the app with `ClerkProvider` only when Clerk is enabled.

## Database Schema

The `User` model includes the following fields for basic auth:

```prisma
model User {
  id           String   @id
  email        String
  name         String?
  passwordHash String?  // For basic auth fallback, hashed with bcrypt
  createdAt    DateTime @default(now())
  // ... other fields
}
```

## API Endpoints

When using basic authentication:

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout and clear session

## Migration from In-Memory to Database

If you previously used the demo users from memory, they are now stored in the database. Run the seed script to populate them.
