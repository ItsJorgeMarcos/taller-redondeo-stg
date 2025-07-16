// src/app/api/reservas/route.ts

import { NextResponse } from 'next/server';
import { formatISO, startOfDay, addDays, parse } from 'date-fns';

const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;     // e.g. midominio.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;    // e.g. shpat_xxx
const API_VERSION = '2025-04';
const SKU_TALLER = '588000000204';

// Tipo de respuesta que va al frontend
type Slot = {
  from: string;           // ISO string
  to: string;             // ISO string
  persons: number;
  orders: string[];       // ["#ST208586 • 2 pax", …]
  attended: boolean[];    // [false, true, …]
};

export async function GET() {
  // 1) Calculamos rango: hoy → +30 días
  const now = new Date();
  const startDate = startOfDay(now);
  const endDate = addDays(startDate, 30);
  const startParam = formatISO(startDate);
  const endParam   = formatISO(endDate);

  // 2) Obtenemos todos los pedidos REST con paginación
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };

  let url =
    `https://${SHOP}/admin/api/${API_VERSION}/orders.json` +
    `?status=any&limit=250` +
    `&created_at_min=${startParam}` +
    `&created_at_max=${endParam}`;

  const orders: any[] = [];
  while (url) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      // back‑off ligero
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Shopify REST error: ${res.status}` },
        { status: 500 }
      );
    }
    const body = (await res.json()) as { orders: any[] };
    orders.push(...body.orders);

    // mirar header Link para siguiente página
    const link = res.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : '';
  }

  // 3) Procesar pedidos y agrupar por slot
  const slots = new Map<
    string,
    {
      from: string;
      to: string;
      persons: number;
      orders: string[];
      attended: boolean[];
    }
  >();

  for (const order of orders) {
    const tagString = order.tags as string;
    const isAttended = tagString.includes('ASISTIDO');

    for (const li of order.line_items as any[]) {
      if (li.sku !== SKU_TALLER) continue;

      // propiedades dentro de la línea
      const props: Record<string, string> = {};
      (li.properties || []).forEach((p: any) => {
        props[p.name] = p.value;
      });

      const rawDate = props['Fecha'] || props['fecha'];
      const rawTime = props['Hora']  || props['hora'];
      if (!rawDate || !rawTime) continue;

      // parsear igual que en roscones
      // rawDate: "20/07/2025" ó "Jul 20, 2025" (ajusta 'parse' si lo necesitas)
      // rawTime: "10:30 AM - 11:10 AM"
      let parsedDate = new Date(rawDate);
      // si usas 'dd/MM/yyyy', descomenta:
      // parsedDate = parse(rawDate, 'dd/MM/yyyy', new Date());
      if (isNaN(parsedDate.getTime())) continue;

      const isoDate = parsedDate.toISOString().split('T')[0];
      const [fromStr, toStr] = rawTime
        .replace(' AM', '')
        .replace(' PM', '')
        .split(' - ');

      const from = new Date(`${isoDate}T${fromStr}:00`);
      const to   = new Date(`${isoDate}T${toStr}:00`);

      // filtrar fuera de rango
      if (from < startDate || from > endDate) continue;

      const key = `${from.toISOString()}_${to.toISOString()}`;
      const slot = slots.get(key) ?? {
        from: from.toISOString(),
        to:   to.toISOString(),
        persons: 0,
        orders: [],
        attended: [],
      };

      slot.persons += li.quantity ?? 0;
      slot.orders.push(`${order.name} • ${li.quantity} pax`);
      slot.attended.push(isAttended);
      slots.set(key, slot);
    }
  }

  // 4) Responder al cliente
  return NextResponse.json(Array.from(slots.values()) as Slot[]);
}
