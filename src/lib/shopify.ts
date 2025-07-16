/* eslint-disable @typescript-eslint/no-explicit-any */
/** ------------------------------------------------------------------
 *  Cliente REST para Shopify — rápido y sin límites de GraphQL
 * ------------------------------------------------------------------ */

const SHOP = process.env.SHOPIFY_STORE_DOMAIN!; // p.e. midominio.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!; // shpat_xxx
const API_VERSION = '2025-04';
const SKU_TALLER = '588000000204';

/* ---------- Tipos mínimos ---------- */
export type BookingLine = {
  orderId: string;
  orderName: string;
  persons: number;
  from: Date;
  to: Date;
  attended: boolean;
};

/* ---------- Paginador REST ---------- */
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

    const link = res.headers.get('link') ?? '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : '';
  }
}

/* ---------- Obtener reservas ---------- */
export async function getBookings(
  rangeStart: Date,
  rangeEnd: Date,
  debug = false
): Promise<BookingLine[]> {
  const out: BookingLine[] = [];

  for await (const order of fetchOrders(rangeStart, rangeEnd)) {
    const attended = (order.tags as string).includes('ASISTIDO');

    for (const li of order.line_items as any[]) {
      if (li.sku !== SKU_TALLER) continue;

      /* Diccionario de propiedades en minúsculas */
      const props: Record<string, string> = {};
      (li.properties ?? []).forEach((p: any) => {
        props[p.name.toLowerCase()] = p.value;
      });

      /* Buscar la primera key que contenga “fecha” / “hora” */
      const rawDate =
        Object.entries(props).find(([k]) => k.includes('fecha'))?.[1] ?? '';
      const rawTime =
        Object.entries(props).find(([k]) => k.includes('hora'))?.[1] ?? '';
      if (!rawDate || !rawTime) continue;

      const isoDate = new Date(rawDate).toISOString().split('T')[0];
      const [fromStr, toStr] = rawTime
        .replace(' AM', '')
        .replace(' PM', '')
        .split(' - ');
      const from = new Date(`${isoDate}T${fromStr}:00`);
      const to   = new Date(`${isoDate}T${toStr}:00`);
      if (from < rangeStart || from > rangeEnd) continue;

      out.push({
        orderId: String(order.id),
        orderName: order.name,
        persons: li.quantity ?? 0,
        from,
        to,
        attended,
      });
    }
  }

  if (debug) console.log('[bookings]', out.length, out.slice(0, 3));
  return out;
}

/* ---------- Marcar pedido asistido ---------- */
export async function markAttended(orderId: string, user: string) {
  const id = orderId.split('/').pop(); // extraer numérico del gid
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };

  /* Traemos el pedido para no sobrescribir otras etiquetas */
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
