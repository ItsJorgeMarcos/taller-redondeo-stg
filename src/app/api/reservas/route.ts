import { markAttended } from '@/lib/shopify';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) return new Response('Missing orderId', { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

  await markAttended(orderId, session.user.email);
  return new Response(null, { status: 204 });
}
