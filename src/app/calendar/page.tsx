import Calendar from '@/components/Calendar';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=/calendar`);
  }

  return (
    <>
      <h1 className="text-3xl font-bold text-center text-[#F0816C] underline my-6">
        Calendario Taller Redondeo
      </h1>
      <Calendar />
    </>
  );
}
