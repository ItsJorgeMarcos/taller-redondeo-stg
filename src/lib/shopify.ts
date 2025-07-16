import { LATEST_API_VERSION } from "@shopify/shopify-api";

/* === Utilidad para llamar a la Admin GraphQL API === */
async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${LATEST_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const json = await res.json();
  if (json.errors) {
    console.error("Shopify API errors:", JSON.stringify(json.errors, null, 2));
    throw new Error("Error al consultar Shopify");
  }
  return json.data;
}

/* === Tipos === */
export type BookingLine = {
  orderId: string;
  orderName: string;
  persons: number;
  from: Date;
  to: Date;
  attended: boolean;
};

const SKU_TALLER = "588000000204";

/* === Consultar pedidos con el SKU del taller === */
export async function getBookings(
  from: Date,
  to: Date
): Promise<BookingLine[]> {
  const bookings: BookingLine[] = [];
  let cursor: string | null = null;

  const dateQuery = `created_at:>=${from.toISOString()} AND created_at:<=${to.toISOString()}`;
  const skuQuery = `line_items.sku:${SKU_TALLER}`;

  const GQL = /* GraphQL */ `
    query Orders($query: String!, $cursor: String) {
      orders(first: 100, query: $query, after: $cursor) {
        pageInfo { hasNextPage }
        edges {
          cursor
          node {
            id
            name
            tags
            metafield(namespace: "reservas", key: "fecha") { value }
            metafield(namespace: "reservas", key: "hora")  { value }
            lineItems(first: 100) {
              edges {
                node {
                  sku
                  quantity
                  properties {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  do {
    const data = await shopifyFetch<{
      orders: {
        pageInfo: { hasNextPage: boolean };
        edges: any[];
      };
    }>(GQL, { query: `${dateQuery} AND ${skuQuery}`, cursor });

    data.orders.edges.forEach((edge) => {
      cursor = edge.cursor;
      const order = edge.node;
      const attended = order.tags?.includes("ASISTIDO");

      order.lineItems.edges
        .filter((le: any) => le.node.sku === SKU_TALLER)
        .forEach((le: any) => {
          const { quantity, properties } = le.node;

          const rawDate =
            order.metafield?.value ??
            properties.find((p: any) => p.name === "Fecha")?.value;
          const rawTime =
            order.metafield?.value ??
            properties.find((p: any) => p.name === "Hora")?.value;

          if (!rawDate || !rawTime) return;

          // Ej. rawDate = "Jul 20, 2025" • rawTime = "10:30 AM - 11:10 AM"
          const fechaISO = new Date(rawDate).toISOString().split("T")[0];

          const [fromStr, toStr] = rawTime
            .replace(" AM", "")
            .replace(" PM", "")
            .split(" - ");

          const from = new Date(`${fechaISO}T${fromStr}:00`);
          const to = new Date(`${fechaISO}T${toStr}:00`);

          bookings.push({
            orderId: order.id,
            orderName: order.name,
            persons: quantity,
            from,
            to,
            attended,
          });
        });
    });
  } while (cursor);

  return bookings;
}

/* === Marcar pedido como asistido y registrar quién lo hizo === */
export async function markAttended(orderId: string, userEmail: string) {
  const GQL = /* GraphQL */ `
    mutation Asistido($id: ID!, $tags: [String!], $meta: [MetafieldInput!]) {
      orderUpdate(input: { id: $id, tags: $tags, metafields: $meta }) {
        userErrors { field message }
      }
    }
  `;

  await shopifyFetch(GQL, {
    id: orderId,
    tags: ["ASISTIDO", `ASISTIDO_POR_${userEmail}`],
    meta: [
      {
        namespace: "taller",
        key: "asistido_por",
        type: "single_line_text_field",
        value: userEmail,
      },
    ],
  });
}
