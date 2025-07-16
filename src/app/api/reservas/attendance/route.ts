// src/app/api/reservas/attendance/route.ts
import { NextResponse } from 'next/server';
import { markSlotAttended, unmarkSlotAttended } from '@/lib/shopify';

export async function POST(req: Request) {
  try {
    const { gid, slotISO, user, count } = await req.json();
    await markSlotAttended(gid, slotISO, user, count);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { gid, slotISO } = await req.json();
    await unmarkSlotAttended(gid, slotISO);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
