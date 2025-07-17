// src/lib/shopify.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------------------------------------
// Configuración de Shopify
// --------------------------------------------
const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;    // e.g. "mi-tienda.myshopify.com"
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;   // Admin API token
const API_VERSION = '2023-10';
const SKU_TARGET = '588000000204';

// --------------------------------------------
// Tipos internos
// --------------------------------------------
interface ShopifyOrder {
  admin_graphql_api_id: string;
  name: string;
  note_attributes?: NoteAttribute[];
  line_items: ShopifyLineItem[];
}

interface ShopifyLineItem {
  sku: string;
  quantity: number;
  properties?: ShopifyProperty[];
}

interface ShopifyProperty {
  name: string;
  value: any;
}

interface NoteAttribute {
  name: string;
  value: any;
}

export interface BookingLine {
  orderGid: string;
  orderName: string;
  persons: number;
  fromISO: string;
  toISO: string;
  attended: boolean;
}

// --------------------------------------------
// Parsea el header Link de Shopify para paginación REST
// --------------------------------------------
function parseLinkHeader(header: string): Record<string, string> {
  const parts = header.split(',');
  const map: Record<string, string> = {};
  for (const part of parts) {
    const m = part.match(/<[^?]+\?page_info=([^>]+)>;\s*rel="([^"]+)"/);
    if (m) {
      map[m[2]] = m[1];
    }
  }
  return map;
}

// --------------------------------------------
// Obtiene todas las reservas (REST) paginadas
// --------------------------------------------
export async function getBookings(now: Date, max: Date): Promise<BookingLine[]> {
  let pageInfo: string | null = null;
  const allOrders: ShopifyOrder[] = [];

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

    const json = await res.json() as { orders: ShopifyOrder[] };
    allOrders.push(...json.orders);

    const link = res.headers.get('Link');
    pageInfo = link ? parseLinkHeader(link).next || null : null;
  } while (pageInfo);

  const out: BookingLine[] = [];
  for (const order of allOrders) {
    const orderGid = order.admin_graphql_api_id;
    const orderName = order.name;
    const noteAttrs = order.note_attributes ?? [];

    for (const li of order.line_items) {
      if (li.sku !== SKU_TARGET) continue;
      const props = li.properties ?? [];

      const tsProp = props.find((p: ShopifyProperty) => p.name === '_booking_start_timestamp');
      const durProp = props.find((p: ShopifyProperty) => p.name === '_booking_duration');
      if (!tsProp || !durProp) continue;

      const ts = Number(tsProp.value);
      const dur = Number(durProp.value);
      if (isNaN(ts) || isNaN(dur)) continue;

      const from = new Date(ts);
      if (from < now || from > max) continue;
      const to = new Date(ts + dur * 60000);

      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      const flag = `Asistido_${fromISO}_${orderGid}`;
      const attended = noteAttrs.some((n: NoteAttribute) => n.name === flag);

      out.push({
        orderGid,
        orderName,
        persons: li.quantity,
        fromISO,
        toISO,
        attended,
      });
    }
  }

  return out;
}

// --------------------------------------------
// Añade/elimina nota de asistido en el pedido
// --------------------------------------------
async function updateNotes(
  orderGid: string,
  slotISO: string,
  add: boolean,
  user?: string
): Promise<void> {
  const id = Number(orderGid.split('/').pop());
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;

  const getRes = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!getRes.ok) throw new Error(`Fetch order failed: ${getRes.status}`);

  const { order } = await getRes.json() as { order: ShopifyOrder & { id: number } };
  const existing = order.note_attributes ?? [];
  const notes = existing.filter((n: NoteAttribute) => n.name !== `Asistido_${slotISO}_${orderGid}`);

  if (add && user) {
    notes.push({ name: `Asistido_${slotISO}_${orderGid}`, value: `${user}_${new Date().toISOString()}` });
  }

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

export function markLineAttended(orderGid: string, slotISO: string, user: string): Promise<void> {
  return updateNotes(orderGid, slotISO, true, user);
}

export function unmarkLineAttended(orderGid: string, slotISO: string): Promise<void> {
  return updateNotes(orderGid, slotISO, false);
}
