// src/app/api/reservas/attendance/route.ts
import { NextResponse } from 'next/server';
import { markSlotAttended, unmarkSlotAttended } from '@/lib/shopify';

interface MarkBody {
  gid: string;
  slotISO: string;
  user: string;
  count: number;
}

interface UnmarkBody {
  gid: string;
  slotISO: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as MarkBody;
    await markSlotAttended(body.gid, body.slotISO, body.user, body.count);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error marking attended:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as UnmarkBody;
    await unmarkSlotAttended(body.gid, body.slotISO);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error unmarking attended:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
