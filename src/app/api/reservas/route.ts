// src/app/api/reservas/route.ts
import { NextResponse } from 'next/server';
import { addDays } from 'date-fns';
import { getBookings, type BookingLine } from '@/lib/shopify';

type Slot = {
  from: string;
  to: string;
  orders: Array<{
    gid: string;
    name: string;
    persons: number;
    attended: boolean;
  }>;
};

export async function GET() {
  const now = new Date();
  const max = addDays(now, 30);
  const lines: BookingLine[] = await getBookings(now, max);

  // Agrupamos slots y dentro de cada slot agrupamos pedidos iguales
  const map = new Map<string, Slot>();

  for (const b of lines) {
    // clave única para el slot (misma fecha/hora)
    const key = b.fromISO;

    // si el slot no existe, lo inicializamos
    const slot = map.get(key) ?? {
      from: b.fromISO,
      to: b.toISO,
      orders: [],
    };

    // buscamos si ya existe ese pedido en el slot
    const existing = slot.orders.find((o) => o.gid === b.orderGid);
    if (existing) {
      // si ya existía, sumamos personas y mantenemos el attended si alguno lo estaba
      existing.persons += b.persons;
      existing.attended = existing.attended || b.attended;
    } else {
      // si no existía, lo añadimos
      slot.orders.push({
        gid: b.orderGid,
        name: b.orderName,
        persons: b.persons,
        attended: b.attended,
      });
    }

    map.set(key, slot);
  }

  // convertimos a array y ordenamos cronológicamente
  const slots = Array.from(map.values()).sort(
    (a, b) => new Date(a.from).getTime() - new Date(b.from).getTime()
  );

  return NextResponse.json(slots);
}
