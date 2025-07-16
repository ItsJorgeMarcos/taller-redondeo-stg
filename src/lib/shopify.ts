/* eslint-disable @typescript-eslint/no-explicit-any */
/** ------------------------------------------------------------------
 *  src/lib/shopify.ts
 *  ------------------------------------------------------------------
 *  Extrae reservas del SKU 588000000204 desde la REST API de Shopify.
 *  Reconoce:
 *    - Propiedad “Reservas”  →  "Fecha: ... Hora: ... - ..."
 *  ------------------------------------------------------------------ */

const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;   // midominio.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;  // shpat_xxx
const API_VERSION = '2025-04';
const SKU = '588000000204';

/* ---------- Slot que consume el frontend ---------- */
export type BookingLine = {
  orderId: string;
  orderName: string;
  persons: number;
  from: Date;
  to: Date;
  attended: boolean;
};

/* ---------- Paginador orders.json ---------- */
async function* fetchOrders(start: Date, end: Date) {
  let url =
    `https://${SHOP}/admin/api/${API_VERSION}/orders.json` +
    `?status=any&limit=250` +
    `&created_at_min=${start.toISOString()}` +
    `&created_at_max=${end.toISOString()}`;

  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };

  while (url) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Shopify REST ${res.status}`);
    const body = (await res.json()) as { orders: any[] };
    yield* body.orders;

    const next = res.headers
      .get('link')
      ?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : '';
  }
}

/* ---------- Parser "Fecha: ... Hora: ... - ..." ---------- */
function splitReservas(value: string): { date: string; time: string } | null {
  const m = value.match(/Fecha:\s*([^H]+)Hora:\s*(.+)/i);
  if (!m) return null;
  return { date: m[1].trim(), time: m[2].trim() };
}

/* ---------- Booking extractor seguro ---------- */
export async function getBookings(
  from: Date,
  to: Date,
  debug = false
): Promise<BookingLine[]> {
  const out: BookingLine[] = [];

  for await (const order of fetchOrders(from, to)) {
    const attended = (order.tags as string).includes('ASISTIDO');

    for (const li of order.line_items as any[]) {
      if (li.sku !== SKU) continue;

      /* 1. localizar la propiedad Reservas */
      const reservasProp = (li.properties ?? []).find(
        (p: any) => p.name.toLowerCase() === 'reservas'
      );
      if (!reservasProp) continue;

      const match = String(reservasProp.value).match(
        /Fecha:\s*([^H]+)\s*Hora:\s*(.+)\s*-\s*(.+)/i
      );
      if (!match) continue;

      const rawDate = match[1].trim();        // "Jul 20, 2025"
      const rawFrom = match[2].trim();        // "10:30 AM"
      const rawTo   = match[3].trim();        // "11:10 AM"

      const start = new Date(`${rawDate} ${rawFrom}`);
      const end   = new Date(`${rawDate} ${rawTo}`);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
      if (start < from || start > to) continue;

      out.push({
        orderId: String(order.id),
        orderName: order.name,
        persons: li.quantity ?? 0,
        from: start,
        to: end,
        attended,
      });
    }
  }

  if (debug) console.log('[bookings]', out.length);
  return out;
}


/* ---------- Marcar asistido ---------- */
export async function markAttended(orderId: string, user: string) {
  const id = orderId.split('/').pop();
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };

  const cur = await fetch(url, { headers }).then((r) => r.json());
  const tags = (cur.order.tags as string)
    .split(',')
    .map((t: string) => t.trim())
    .filter(Boolean);
  tags.push('ASISTIDO', `ASISTIDO_POR_${user}`);

  await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      order: {
        id: cur.order.id,
        tags: Array.from(new Set(tags)).join(', '),
        metafields: [
          {
            namespace: 'taller',
            key: 'asistido_por',
            type: 'single_line_text_field',
            value: user,
          },
        ],
      },
    }),
  });
}
