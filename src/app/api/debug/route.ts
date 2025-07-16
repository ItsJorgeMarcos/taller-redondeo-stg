import { getBookings } from '@/lib/shopify';

export async function GET() {
  try {
    const now = new Date();
    const to = new Date(now);
    to.setDate(now.getDate() + 30);

    const data = await getBookings(now, to, true);
    return Response.json(data);
  } catch (err) {
    console.error('[DEBUG]', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
