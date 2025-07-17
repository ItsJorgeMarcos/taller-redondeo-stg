// src/components/Calendar.tsx
'use client';

import React from 'react';
import useSWR from 'swr';
import { format, compareAsc } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface OrderInfo {
  gid: string;
  name: string;
  persons: number;
  attended: boolean;
}

interface Slot {
  from: string;
  to: string;
  orders: OrderInfo[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Calendar() {
  const { data, error, isLoading, mutate } = useSWR<Slot[]>('/api/reservas', fetcher, {
    refreshInterval: 60000,
  });
  const { data: session } = useSession();

  if (error) {
    return <p className="mt-6 text-center text-red-600">Error: {String(error)}</p>;
  }
  if (isLoading) {
    return <p className="mt-6 text-center text-gray-500">Cargando…</p>;
  }
  if (!data || data.length === 0) {
    return <p className="mt-6 text-center text-gray-600">No hay reservas en 30 días.</p>;
  }

  // Ordenar slots cronológicamente
  const sorted = [...data].sort((a, b) =>
    compareAsc(new Date(a.from), new Date(b.from))
  );

  // Agrupar por día (YYYY-MM-DD)
  const grouped: Record<string, Slot[]> = {};
  sorted.forEach((slot) => {
    const day = slot.from.slice(0, 10);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(slot);
  });

  return (
    <div className="p-4 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Object.entries(grouped).map(([day, slots]) => (
        <div
          key={day}
          className="rounded-xl border-2 border-[#F0816C] bg-white p-4 shadow-md dark:bg-gray-800 dark:border-[#F0816C]/80"
        >
          <h3 className="mb-4 text-lg font-bold text-[#F0816C]">
            {format(new Date(day), 'eeee dd MMM yyyy', { locale: es })}
          </h3>
          <div className="space-y-4">
            {slots.map((slot) => {
              const total = slot.orders.reduce((sum, o) => sum + o.persons, 0);
              return (
                <div key={slot.from} className="p-3 border rounded-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center bg-[#FAEDEB] text-gray-800 px-2 py-1 rounded text-sm font-semibold">
                      <Clock className="w-4 h-4 text-[#F0816C] mr-1" />
                      {format(new Date(slot.from), 'HH:mm')} – 
                      {format(new Date(slot.to), 'HH:mm')}
                    </span>
                    <span className="px-3 py-1 bg-[#F0816C] text-white rounded-full text-sm font-medium">
                      {total}/15 pers
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {slot.orders.map((order) => (
                      <li key={order.gid} className="flex items-center justify-between">
                        <span className={order.attended ? 'line-through text-gray-500' : ''}>
                          {order.name} • {order.persons} pers
                        </span>
                        <button
                          className={`ml-4 rounded px-3 py-1 text-sm font-medium text-white flex items-center ${
                            order.attended
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-[#F0816C] hover:bg-[#e67061]'
                          }`}
                          onClick={async () => {
                            const user = session?.user?.name;
                            if (!user) {
                              alert('Inicia sesión para marcar asistido.');
                              return;
                            }
                            const method = order.attended ? 'DELETE' : 'POST';
                            const res = await fetch('/api/reservas/attendance', {
                              method,
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gid: order.gid,
                                slotISO: slot.from,
                                user,
                              }),
                            });
                            const json = await res.json();
                            if (!json.ok) {
                              alert('Error: ' + json.error);
                            } else {
                              mutate();
                            }
                          }}
                        >
                          {order.attended ? (
                            <><XCircle className="w-4 h-4 mr-1" />Desmarcar</>
                          ) : (
                            <><CheckCircle className="w-4 h-4 mr-1" />Asistido</>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
