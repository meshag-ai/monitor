import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.warn('Clerk webhook called with missing svix headers');
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error({ err }, 'Error verifying Clerk webhook');
    return new Response('Error occurred', {
      status: 400,
    });
  }

  const log = logger.child({ webhookId: evt.data.id, eventType: evt.type });

  try {
    if (evt.type === 'user.created') {
      log.info('Processing user.created webhook');
      await prisma.user.create({
        data: {
          id: evt.data.id,
          email: evt.data.email_addresses[0]?.email_address || '',
        },
      });
      log.info('User created successfully');
    }

    if (evt.type === 'user.updated') {
      log.info('Processing user.updated webhook');
      await prisma.user.update({
        where: { id: evt.data.id },
        data: {
          email: evt.data.email_addresses[0]?.email_address || '',
        },
      });
      log.info('User updated successfully');
    }

    if (evt.type === 'user.deleted') {
      log.info('Processing user.deleted webhook');
      await prisma.user.delete({
        where: { id: evt.data.id! },
      });
      log.info('User deleted successfully');
    }
  } catch (error) {
    log.error({ error }, 'Error processing Clerk webhook');
    return new Response('Error occurred', { status: 500 });
  }

  return new Response('', { status: 200 });
}
