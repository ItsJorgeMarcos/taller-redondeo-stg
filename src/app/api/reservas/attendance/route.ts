// src/app/api/reservas/attendance/route.ts
import { NextResponse } from 'next/server';
import {
  markLineAttended,
  unmarkLineAttended,
} from '@/lib/shopify';

interface Body {
  gid: string;
  slotISO: string;
  user: string;
}

export async function POST(request: Request) {
  try {
    const { gid, slotISO, user } = (await request.json()) as Body;
    await markLineAttended(gid, slotISO, user);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { gid, slotISO } = (await request.json()) as Body;
    await unmarkLineAttended(gid, slotISO);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
