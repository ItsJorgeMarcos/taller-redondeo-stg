// src/app/calendar/page.tsx

import Calendar from '@/components/Calendar';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';        // <-- Import correcto desde lib/auth
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  // Protege vía sesión server‑side
  const session = await getServerSession(authOptions);
  if (!session) {
    // Si no hay sesión, redirige al login y regresa a /calendar
    redirect(`/api/auth/signin?callbackUrl=/calendar`);
  }

  // Si está logueado, renderiza el componente cliente
  return <Calendar />;
}
