import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import crypto from 'node:crypto';

type UserRec = { name: string; pass: string };

function loadUsers(): UserRec[] {
  return (process.env.AUTH_USERS ?? '')
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [name, pass] = pair.split(':');
      return { name, pass };
    });
}

/* Compara de forma constante para evitar timing‑attacks */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Login Taller',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(creds) {
        if (!creds) return null;
        const user = loadUsers().find((u) => u.name === creds.username);
        if (!user) return null;
        const ok = safeEqual(creds.password, user.pass);
        return ok ? { id: user.name, name: user.name } : null;
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
