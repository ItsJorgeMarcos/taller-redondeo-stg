// src/components/Calendar.tsx
'use client';

import React from 'react';
import useSWR from 'swr';
import { format, compareAsc } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { CheckCircle, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';

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

export default function Calendar() {
  const { data, error, isLoading, mutate } = useSWR<Slot[]>('/api/reservas', fetcher, {
    refreshInterval: 60000
  });

  if (error) {
    return (
      <p className="mt-10 text-center text-lg text-red-600">
        Error: {String(error)}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="mt-10 text-center text-lg text-gray-500 dark:text-gray-400">
        Cargando…
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="mt-10 text-center text-lg text-gray-600 dark:text-gray-400">
        No hay reservas en 30 días.
      </p>
    );
  }

  const sortedSlots = [...data].sort((slotA, slotB) =>
    compareAsc(new Date(slotA.from), new Date(slotB.from))
  );

  const groupedByDay: Record<string, Slot[]> = {};
  sortedSlots.forEach((slot) => {
    const dayKey = slot.from.slice(0, 10);
    if (!groupedByDay[dayKey]) {
      groupedByDay[dayKey] = [];
    }
    groupedByDay[dayKey].push(slot);
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Object.entries(groupedByDay).map(([day, slots]) => (
        <DayCard
          key={day}
          day={day}
          slots={slots}
          onMutate={mutate}
        />
      ))}
    </div>
  );
}

interface DayCardProps {
  day: string;
  slots: Slot[];
  onMutate: () => void;
}

function DayCard({ day, slots, onMutate }: DayCardProps) {
  return (
    <div className="relative rounded-3xl border-2 border-[#F0816C] bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow duration-200 dark:bg-gray-800 dark:border-[#F0816C]/80">
      <h3 className="mb-6 flex items-center gap-3 border-b-2 pb-3 text-xl font-extrabold text-[#F0816C] dark:text-[#F0816C]/90">
        <CalendarIcon className="h-6 w-6" />
        {format(new Date(day), 'eeee dd MMM yyyy', { locale: es })}
      </h3>
      <div className="space-y-6">
        {slots.map((slot) => (
          <SlotCard
            key={slot.from}
            slot={slot}
            onMutate={onMutate}
          />
        ))}
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: Slot;
  onMutate: () => void;
}

function SlotCard({ slot, onMutate }: SlotCardProps) {
  const { data: session } = useSession();
  const isOverbooked = slot.persons > 15;
  const isAttended = slot.attended;

  let containerClasses = 'border-[#F0816C]/40 bg-[#FAEDEB] dark:border-[#F0816C]/30 dark:bg-[#2C2A34]';
  if (isAttended) {
    containerClasses = 'border-green-600 bg-green-100 dark:bg-green-900/20';
  } else if (isOverbooked) {
    containerClasses = 'border-red-600 bg-red-100 dark:bg-red-900/20';
  }

  let statusIcon = null;
  if (isAttended) {
    statusIcon = <CheckCircle className="h-6 w-6 text-green-600" />;
  } else if (isOverbooked) {
    statusIcon = <AlertTriangle className="h-6 w-6 text-red-600" />;
  }

  return (
    <div className={`relative rounded-3xl border-2 p-6 sm:p-4 transition-shadow duration-150 hover:shadow-md ${containerClasses}`}>
      {statusIcon && <div className="absolute top-4 right-4">{statusIcon}</div>}
      <div className="mb-4 flex items-center justify-between">
        <span className={`text-lg font-semibold ${isAttended ? 'line-through text-gray-500' : 'text-black dark:text-white'}`}>
          {format(new Date(slot.from), 'HH:mm')} — {format(new Date(slot.to), 'HH:mm')}
        </span>
        <span className="px-4 py-1.5 rounded-full bg-[#F0816C] text-white text-base font-semibold shadow-sm">
          {slot.persons}/15 pers
        </span>
      </div>
      <ul className={`mb-6 space-y-1 text-base ${isAttended ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
        {slot.orders.map((order) => (
          <li key={order.gid}>
            {order.name} • {order.persons} pers
          </li>
        ))}
      </ul>
      <button
        disabled={isAttended}
        className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white transition-transform duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#F0816C]/70 ${
          isAttended ? 'bg-green-600 cursor-default' : 'bg-[#F0816C] hover:bg-[#e67061]'
        }`}
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
        {isAttended
          ? 'Completado'
          : (
            <>
              <MinusCircle className="h-5 w-5 text-white" />
              Marcar completado
            </>
          )}
      </button>
    </div>
  );
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#F0816C" {...props}>
      <path d="M5 2a1 1 0 0 1 1 1v1h12V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM2 10h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8z" />
    </svg>
  );
}
