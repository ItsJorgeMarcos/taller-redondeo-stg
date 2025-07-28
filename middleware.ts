// middleware.ts
import { withAuth } from 'next-auth/middleware';
import type { NextRequest } from 'next/server';

export default withAuth(
  function middleware(req: NextRequest) {
    // puede quedarse vacío, conAuth ya redirige si no hay token
    return;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Sólo protégete estas rutas:
export const config = {
  matcher: ['/calendar/:path*', '/api/reservas/:path*'],
};
