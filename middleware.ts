// middleware.ts
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Este secreto debe coincidir con NEXTAUTH_SECRET
const secret = process.env.NEXTAUTH_SECRET!;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // No proteger rutas estáticas, _next y auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Comprobar token
  const token = await getToken({ req, secret });
  if (!token) {
    // Redirigir a signin, manteniendo la ruta de regreso
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/api/auth/signin';
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// Aplicar middleware a la página de calendario y a tus APIs de reservas
export const config = {
  matcher: ['/calendar/:path*', '/api/reservas/:path*', '/'],
};
