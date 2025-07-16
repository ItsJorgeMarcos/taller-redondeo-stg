"use client";

import useSWR from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSession } from "next-auth/react";

type Slot = {
  from: string;
  to: string;
  persons: number;
  orders: string[];
  attended: boolean[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Calendar() {
  const { data, isLoading } = useSWR<Slot[]>("/api/reservas", fetcher);

  if (isLoading) return <p>Cargando…</p>;
  if (!data?.length) return <p>No hay reservas en 30 días.</p>;

  const daySlots = data.reduce<Record<string, Slot[]>>((acc, s) => {
    const day = s.from.split("T")[0];
    (acc[day] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Object.entries(daySlots).map(([day, slots]) => (
        <div key={day} className="rounded border p-2">
          <h3 className="mb-2 border-b pb-1 text-sm font-semibold">
            {format(new Date(day), "eeee dd MMM yyyy", { locale: es })}
          </h3>
          {slots.map((s) => (
            <SlotCard key={s.from} slot={s} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SlotCard({ slot }: { slot: Slot }) {
  const { data: session } = useSession();
  const overbooked = slot.persons > 15;
  const anyAttended = slot.attended.some(Boolean);

  const orderId = slot.orders[0].split(" ")[0]; // "#ST208586"

  return (
    <div
      className={`mb-2 rounded p-1 text-sm ${
        overbooked ? "bg-red-100" : "bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span>
          {slot.from.slice(11, 16)}‑{slot.to.slice(11, 16)}
        </span>
        <span className="font-bold">{slot.persons} pax</span>
      </div>

      <ul className="ml-4 list-disc">
        {slot.orders.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <button
        className={`mt-1 rounded px-2 py-0.5 text-xs ${
          anyAttended ? "bg-green-500" : "bg-sky-500"
        } text-white`}
        onClick={async () => {
          if (!session?.user?.email) return alert("Inicia sesión");
          await fetch("/api/reservas/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
          location.reload();
        }}
      >
        {anyAttended ? "Asistido ✓" : "Marcar asistido"}
      </button>
    </div>
  );
}
