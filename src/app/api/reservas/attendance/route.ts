// src/app/api/reservas/attendance/route.ts
import { NextResponse } from 'next/server';
import { markLineAttended, unmarkLineAttended } from '@/lib/shopify';

interface Body {
  gid: string;
  slotISO: string;
  user?: string;
}

export async function POST(request: Request) {
  try {
    const { gid, slotISO, user } = (await request.json()) as Body;
    if (!user) throw new Error('User missing');
    await markLineAttended(gid, slotISO, user);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { gid, slotISO } = (await request.json()) as Body;
    await unmarkLineAttended(gid, slotISO);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
