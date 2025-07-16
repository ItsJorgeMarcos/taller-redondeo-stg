// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { NextResponse } from 'next/server';
import { startOfDay, addDays } from 'date-fns';
import { getBookings, type BookingLine } from '@/lib/shopify';

type Slot = {
  from: string;
  to: string;
  persons: number;
  orders: string[];
  attended: boolean[];
};

export async function GET() {
  const now = startOfDay(new Date());
  const end = addDays(now, 30);

  const bookings: BookingLine[] = await getBookings(now, end, false);

  const slots = new Map<string, Slot>();

  for (const b of bookings) {
    const key = `${b.from.toISOString()}_${b.to.toISOString()}`;
    const slot = slots.get(key) ?? {
      from: b.from.toISOString(),
      to:   b.to.toISOString(),
      persons: 0,
      orders: [],
      attended: [],
    };
    slot.persons += b.persons;
    slot.orders.push(`${b.orderName} • ${b.persons} pax`);
    slot.attended.push(b.attended);
    slots.set(key, slot);
  }

  return NextResponse.json(Array.from(slots.values()));
}
