/** ------------------------------------------------------------------
 *  src/lib/shopify.ts
 *  ------------------------------------------------------------------
 *  Cliente REST para Shopify, simplificado para asegurar que
 *  trae cualquier pedido con el SKU de taller y lo filtra
 *  por la fecha de actividad (desde sus propiedades).
 * ------------------------------------------------------------------ */

import { formatISO } from 'date-fns';

/* 1 · Configuración desde .env ------------------------------------- */
const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;  // e.g. midominio.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!; // e.g. shpat_xxx
const API_VERSION = '2025-04';                  // versión REST
const SKU_TALLER = '588000000204';

/* 2 · Tipos -------------------------------------------------------- */
export type BookingLine = {
  orderId: string;
  orderName: string;
  persons: number;
  from: Date;
  to: Date;
  attended: boolean;
};

/* 3 · Helper REST con paginación en Link header ------------------- */
async function* fetchOrdersREST() {
  let url = `https://${SHOP}/admin/api/${API_VERSION}/orders.json?status=any&limit=250`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };

  while (url) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      // back‑off ligero
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Shopify REST error: ${res.status}`);
    }
    const body = (await res.json()) as { orders: any[] };
    yield* body.orders;

    // avanza al siguiente page si existe
    const link = res.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : '';
  }
}

/* 4 · Obtener y filtrar reservas ---------------------------------- */
export async function getBookings(
  rangeStart: Date,
  rangeEnd: Date,
  debug = false
): Promise<BookingLine[]> {
  const bookings: BookingLine[] = [];

  for await (const order of fetchOrdersREST()) {
    const attended = (order.tags as string).includes('ASISTIDO');

    // iteramos cada línea con el SKU de taller
    (order.line_items as any[]).forEach((li) => {
      if (li.sku !== SKU_TALLER) return;

      // extraer propiedades de fecha/hora de line_items.properties
      const props = Array.isArray(li.properties)
        ? Object.fromEntries(
            li.properties.map((p: any) => [p.name, p.value])
          )
        : {};

      const rawDate = props['Fecha'] ?? props['fecha'];
      const rawTime = props['Hora'] ?? props['hora'];
      if (!rawDate || !rawTime) return;

      // parsear
      const isoDate = new Date(rawDate).toISOString().split('T')[0];
      const [fromStr, toStr] = rawTime.replace(' AM','').replace(' PM','').split(' - ');
      const from = new Date(`${isoDate}T${fromStr}:00`);
      const to   = new Date(`${isoDate}T${toStr}:00`);
      if (from < rangeStart || from > rangeEnd) return;

      bookings.push({
        orderId: String(order.id),
        orderName: order.name,
        persons: li.quantity,
        from,
        to,
        attended,
      });
    });
  }

  if (debug) console.log('[REST bookings]', bookings);
  return bookings;
}

/* 5 · Marcar pedido como asistido ------------------------------- */
export async function markAttended(orderId: string, user: string) {
  // obtenemos el pedido completo para no sobrescribir tags existentes
  const idNum = orderId.toString().split('/').pop();
  const urlGet = `https://${SHOP}/admin/api/${API_VERSION}/orders/${idNum}.json`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };
  const current = await fetch(urlGet, { headers }).then((r) => r.json());
  const existingTags = (current.order.tags as string).split(',').map((t) => t.trim());

  const newTags = Array.from(
    new Set([...existingTags, 'ASISTIDO', `ASISTIDO_POR_${user}`])
  ).filter(Boolean).join(', ');

  // actualizamos tags + añadimos metafield de auditoría
  const urlPut = urlGet;
  await fetch(urlPut, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      order: {
        id: current.order.id,
        tags: newTags,
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
