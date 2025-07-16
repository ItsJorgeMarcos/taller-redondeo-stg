// src/lib/shopify.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;    // e.g. tienda.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;   // tu Admin API token
const API_VERSION = '2025-04';
const SKU = '588000000204';

export type BookingLine = {
  orderId: number;
  orderGid: string;
  orderName: string;
  persons: number;
  fromISO: string;
  toISO: string;
  assistedCount: number;
  assistedUser: string | null;
};

// Paginador Shopify REST
async function* fetchOrders(): AsyncGenerator<any> {
  let url = `https://${SHOP}/admin/api/${API_VERSION}/orders.json?status=any&limit=250`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };
  while (url) {
    const res = await fetch(url, { headers });
    if (res.status === 429) { await new Promise(r=>setTimeout(r,1000)); continue; }
    if (!res.ok) throw new Error(`Shopify REST ${res.status}`);
    const { orders } = (await res.json()) as { orders: any[] };
    yield* orders;
    url = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || '';
  }
}

// Extrae fecha/hora
function parseReservas(txt: string) {
  const m = txt.match(/Fecha:\s*([^H]+)\s*Hora:\s*([^‑-]+)[‑-]\s*(.+)/i);
  return m && { date: m[1].trim(), from: m[2].trim(), to: m[3].trim() };
}

// Lee pedidos y agrega assistedCount/user desde note_attributes
export async function getBookings(now: Date, max: Date): Promise<BookingLine[]> {
  const out: BookingLine[] = [];
  for await (const o of fetchOrders()) {
    const notes = (o.note_attributes as any[]) || [];
    for (const li of o.line_items as any[]) {
      if (li.sku !== SKU) continue;
      const prop = (li.properties || []).find((p: any) => p.name.toLowerCase() === 'reservas');
      if (!prop) continue;
      const p = parseReservas(String(prop.value));
      if (!p) continue;
      const from = new Date(`${p.date} ${p.from}`);
      const to   = new Date(`${p.date} ${p.to}`);
      if (isNaN(from.getTime()) || from < now || from > max) continue;
      const iso = from.toISOString();
      const clean = iso.replace(/[^a-zA-Z0-9]/g, '_');

      // Buscar nota Asistido_<slot>
      let assistedCount = 0, assistedUser: string | null = null;
      notes.forEach((n) => {
        if (n.name === `Asistido_${clean}` && typeof n.value === 'string') {
          assistedCount += 1;
          assistedUser = n.value;
        }
      });

      out.push({
        orderId: o.id,
        orderGid: o.admin_graphql_api_id,
        orderName: o.name,
        persons: li.quantity || 0,
        fromISO: iso,
        toISO: to.toISOString(),
        assistedCount,
        assistedUser,
      });
    }
  }
  return out;
}

// Marca asistido: añade N note_attributes con nombre Asistido_<slot>, valor user
export async function markSlotAttended(
  orderGid: string,
  slotISO: string,
  user: string,
  count: number
) {
  const id = Number(orderGid.split('/').pop());
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };
  const getRes = await fetch(url, { headers });
  if (!getRes.ok) throw new Error(`Fetch order failed: ${getRes.status}`);
  const { order } = await getRes.json();
  // Filtra previas para este slot
  const clean = slotISO.replace(/[^a-zA-Z0-9]/g, '_');
  const baseNotes = (order.note_attributes as any[] || []).filter(
    (n) => n.name !== `Asistido_${clean}`
  );
  // Añade count veces
  for (let i = 0; i < count; i++) {
    baseNotes.push({ name: `Asistido_${clean}`, value: user });
  }
  // PUT actualiza sólo note_attributes
  const body = { order: { id: order.id, note_attributes: baseNotes } };
  const putRes = await fetch(url, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`Update failed: ${putRes.status} ${txt}`);
  }
}

// Desmarca asistido: elimina todas las note_attributes de ese slot
export async function unmarkSlotAttended(
  orderGid: string,
  slotISO: string
) {
  const id = Number(orderGid.split('/').pop());
  const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${id}.json`;
  const headers = {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
  };
  const getRes = await fetch(url, { headers });
  if (!getRes.ok) throw new Error(`Fetch order failed: ${getRes.status}`);
  const { order } = await getRes.json();
  const clean = slotISO.replace(/[^a-zA-Z0-9]/g, '_');
  const newNotes = (order.note_attributes as any[] || []).filter(
    (n) => n.name !== `Asistido_${clean}`
  );
  const body = { order: { id: order.id, note_attributes: newNotes } };
  const putRes = await fetch(url, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`Unmark failed: ${putRes.status} ${txt}`);
  }
}
