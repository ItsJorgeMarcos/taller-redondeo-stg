// src/lib/shopify.ts
import { parse } from 'date-fns';

const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;    // p.ej. "mi-tienda.myshopify.com"
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;   // tu Admin API token
const API_VERSION = '2023-10';
const SKU_TARGET = '588000000204';

export interface BookingLine {
  orderGid: string;
  orderName: string;
  persons: number;
  fromISO: string;
  toISO: string;
  attended: boolean;
}

/**
 * Parsea el header Link de Shopify para extraer cursors de paginación.
 */
function parseLinkHeader(header: string): Record<string, string> {
  const parts = header.split(',');
  const map: Record<string, string> = {};
  for (const part of parts) {
    const match = part.match(/<[^?]+\?page_info=([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      map[match[2]] = match[1];
    }
  }
  return map;
}

/**
 * Trae todas las líneas de reserva en los próximos 30 días, paginando REST
 * y usando _booking_start_timestamp y _booking_duration de li.properties.
 */
export async function getBookings(now: Date, max: Date): Promise<BookingLine[]> {
  let pageInfo: string | null = null;
  const allOrders: any[] = [];

  // PAGINACIÓN REST sobre /orders.json
  do {
    const url = new URL(`https://${SHOP}/admin/api/${API_VERSION}/orders.json`);
    url.searchParams.set('status', 'any');
    url.searchParams.set('limit', '250');
    if (pageInfo) url.searchParams.set('page_info', pageInfo);

    const res = await fetch(url.toString(), {
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Fetch orders failed: ${res.status}`);
    const json = await res.json();
    allOrders.push(...(json.orders as any[]));

    const link = res.headers.get('Link');
    if (link) {
      const links = parseLinkHeader(link);
      pageInfo = links.next || null;
    } else {
      pageInfo = null;
    }
  } while (pageInfo);

  // PROCESAR cada pedido + línea
  const out: BookingLine[] = [];
  for (const order of allOrders) {
    const orderGid = order.admin_graphql_api_id as string;
    const orderName = order.name as string;
    const noteAttrs = Array.isArray(order.note_attributes)
      ? (order.note_attributes as any[])
      : [];

    for (const li of order.line_items as any[]) {
      if (li.sku !== SKU_TARGET) continue;

      const props = Array.isArray(li.properties) ? li.properties as any[] : [];
      // Timestamp inicio
      const tsProp = props.find((p) => p.name === '_booking_start_timestamp');
      const durProp = props.find((p) => p.name === '_booking_duration');
      if (!tsProp || !durProp) continue;

      const tsValue = Number(tsProp.value);
      const durValue = Number(durProp.value);
      if (isNaN(tsValue) || isNaN(durValue)) continue;

      const from = new Date(tsValue);
      if (from < now || from > max) continue;

      const to = new Date(tsValue + durValue * 60000);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      // Flag único por línea
      const flag = `Asistido_${fromISO}_${orderGid}`;
      const attended = noteAttrs.some((n) => n.name === flag);

      out.push({
        orderGid,
        orderName,
        persons: li.quantity as number,
        fromISO,
        toISO,
        attended,
      });
    }
  }

  return out;
}

/**
 * Interna: añade o elimina el note_attribute de asistido para una línea.
 */
async function updateNotes(
  orderGid: string,
  slotISO: string,
  add: boolean,
  user?: string
) {
  const id = Number(orderGid.split('/').pop());
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;

  // GET pedido
  const getRes = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!getRes.ok) throw new Error(`Fetch order failed: ${getRes.status}`);
  const { order } = await getRes.json();

  // Filtrar previos y añadir o no
  const notes = Array.isArray(order.note_attributes)
    ? order.note_attributes.filter(
        (n: any) => n.name !== `Asistido_${slotISO}_${orderGid}`
      )
    : [];

  if (add && user) {
    notes.push({
      name: `Asistido_${slotISO}_${orderGid}`,
      value: `${user}_${new Date().toISOString()}`,
    });
  }

  // PUT actualiza solo note_attributes
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order: { id: order.id, note_attributes: notes } }),
  });
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`PUT failed ${putRes.status}: ${txt}`);
  }
}

/** Marca una línea de pedido como asistida */
export function markLineAttended(
  orderGid: string,
  slotISO: string,
  user: string
) {
  return updateNotes(orderGid, slotISO, true, user);
}

/** Desmarca una línea de pedido */
export function unmarkLineAttended(orderGid: string, slotISO: string) {
  return updateNotes(orderGid, slotISO, false);
}
