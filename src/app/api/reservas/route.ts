// src/app/api/reservas/route.ts
import { NextResponse } from 'next/server';
import { addDays } from 'date-fns';
import { getBookings, type BookingLine } from '@/lib/shopify';

type Slot = {
  from: string;
  to: string;
  persons: number;
  orders: { gid: string; name: string; persons: number }[];
  attended: boolean;
};

export async function GET(): Promise<NextResponse> {
  const now = new Date();
  const max = addDays(now, 30);
  const bookings: BookingLine[] = await getBookings(now, max);

  const slots = new Map<string, Slot>();
  for (const b of bookings) {
    const key = b.fromISO;
    const slot = slots.get(key) ?? {
      from: b.fromISO,
      to: b.toISO,
      persons: 0,
      orders: [],
      attended: false,
    };
    slot.persons += b.persons;
    slot.attended ||= b.assistedCount > 0;
    const existing = slot.orders.find((o) => o.name === b.orderName);
    if (existing) {
      existing.persons += b.persons;
    } else {
      slot.orders.push({ gid: b.orderGid, name: b.orderName, persons: b.persons });
    }
    slots.set(key, slot);
  }

  const sorted = Array.from(slots.values()).sort(
    (a, b) => new Date(a.from).getTime() - new Date(b.from).getTime()
  );

  return NextResponse.json(sorted);
}
