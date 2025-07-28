// middleware.ts
import { withAuth } from "next-auth/middleware";

// Con esto, cualquier ruta protegida sin sesión te redirige al signin
export default withAuth();

// Rutas a proteger
export const config = {
  matcher: [
    "/calendar",          // protege /calendar
    "/calendar/:path*",   // y sus subrutas
    "/api/reservas/:path*"// protege todas tus APIs de reservas
  ],
};
