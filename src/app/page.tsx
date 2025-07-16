// src/app/page.tsx
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? '/calendar' : '/login');
}
