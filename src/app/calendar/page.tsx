// src/app/calendar/page.tsx
import Calendar from '@/components/Calendar';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  // Si no hay sesión, redirige al login
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/api/auth/signin?callbackUrl=/calendar`);
  }
  // Si está logueado, muestra el calendario
  return <Calendar />;
}
