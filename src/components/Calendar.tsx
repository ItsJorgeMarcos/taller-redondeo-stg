// src/components/Calendar.tsx
'use client';

import React from 'react';
import useSWR from 'swr';
import { format, compareAsc } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { CheckCircle, AlertTriangle, MinusCircle } from 'lucide-react';

interface Slot {
  from: string;
  to: string;
  persons: number;
  orders: Array<{
    gid: string;
    name: string;
    persons: number;
  }>;
  attended: boolean;
}

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function Calendar(): JSX.Element {
  const { data, error, isLoading, mutate } = useSWR<Slot[]>('/api/reservas', fetcher, {
    refreshInterval: 60000,
  });

  if (error) {
    return (
      <p className="mt-6 text-center text-base text-red-600">
        Error: {String(error)}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="mt-6 text-center text-base text-gray-500 dark:text-gray-400">
        Cargando…
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="mt-6 text-center text-base text-gray-600 dark:text-gray-400">
        No hay reservas en 30 días.
      </p>
    );
  }

  const sortedSlots = [...data].sort((a, b) =>
    compareAsc(new Date(a.from), new Date(b.from))
  );

  const groupedByDay: Record<string, Slot[]> = {};
  sortedSlots.forEach((slot) => {
    const dayKey = slot.from.slice(0, 10);
    if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
    groupedByDay[dayKey].push(slot);
  });

  return (
    <div className="p-4 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Object.entries(groupedByDay).map(([day, slots]) => (
        <DayCard key={day} day={day} slots={slots} onMutate={mutate} />
      ))}
    </div>
  );
}

interface DayCardProps {
  day: string;
  slots: Slot[];
  onMutate: () => void;
}

function DayCard({ day, slots, onMutate }: DayCardProps): JSX.Element {
  return (
    <div className="rounded-xl border-2 border-[#F0816C] bg-white p-4 shadow-md hover:shadow-lg transition-shadow duration-150 dark:bg-gray-800 dark:border-[#F0816C]/80">
      <h3 className="mb-4 flex items-center gap-2 border-b pb-2 text-lg font-bold text-[#F0816C] dark:text-[#F0816C]/90">
        {format(new Date(day), 'eeee dd MMM yyyy', { locale: es })}
      </h3>
      <div className="space-y-4">
        {slots.map((slot) => (
          <SlotCard key={slot.from} slot={slot} onMutate={onMutate} />
        ))}
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: Slot;
  onMutate: () => void;
}

function SlotCard({ slot, onMutate }: SlotCardProps): JSX.Element {
  const { data: session } = useSession();
  const isOverbooked = slot.persons > 15;
  const isAttended = slot.attended;

  let containerClasses = 'border-[#F0816C]/30 bg-[#FAEDEB] dark:border-[#F0816C]/20 dark:bg-[#2C2A34]';
  if (isAttended) containerClasses = 'border-green-500 bg-green-50 dark:bg-green-900/10';
  else if (isOverbooked) containerClasses = 'border-red-500 bg-red-50 dark:bg-red-900/10';

  let statusIcon: JSX.Element | null = null;
  if (isAttended) statusIcon = <CheckCircle className="h-5 w-5 text-green-500" />;
  else if (isOverbooked) statusIcon = <AlertTriangle className="h-5 w-5 text-red-500" />;

  return (
    <div className={`relative rounded-lg border-2 p-4 transition-shadow duration-150 hover:shadow-md ${containerClasses}`}>
      {statusIcon && <div className="absolute top-2 right-2">{statusIcon}</div>}
      <div className="mb-3 flex items-center justify-between">
        <span className={`${isAttended ? 'line-through text-gray-500' : 'text-black dark:text-white'} text-base font-semibold`}>
          {format(new Date(slot.from), 'HH:mm')} – {format(new Date(slot.to), 'HH:mm')}
        </span>
        <span className="px-3 py-1 rounded-full bg-[#F0816C] text-white text-sm font-medium">
          {slot.persons}/15 pers
        </span>
      </div>
      <ul className={`${isAttended ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'} mb-4 text-sm space-y-1`}>  
        {slot.orders.map((order) => (
          <li key={order.gid}>
            {order.name} • {order.persons} pers
          </li>
        ))}
      </ul>
      <button
        disabled={isAttended}
        className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#F0816C]/70 ${isAttended ? 'bg-green-500 cursor-default' : 'bg-[#F0816C] hover:bg-[#e67061]'}`}
        onClick={async () => {
          if (!session?.user?.name) {
            alert('Por favor inicia sesión para marcar como completado.');
            return;
          }
          const response = await fetch('/api/reservas/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gid: slot.orders[0].gid,
              slotISO: slot.from,
              user: session.user.name,
              count: slot.persons,
            }),
          });
          const json = await response.json();
          if (!json.ok) {
            alert('Error: ' + (json.error ?? 'desconocido'));
          } else {
            onMutate();
          }
        }}
      >
        {isAttended ? (
          'Completado'
        ) : (
          <>
            <MinusCircle className="h-4 w-4 text-white" />
            Marcar completado
          </>
        )}
      </button>
    </div>
  );
}
