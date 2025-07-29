// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Env var AUTH_USERS must be a comma-separated list of user:password entries.
 * e.g. AUTH_USERS=jorge:jorgejorge,pedro:pedropassword
 */
const usersEnv = process.env.AUTH_USERS || '';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Usuario y Contraseña',
      credentials: {
        user: { label: 'Usuario', type: 'text' },
        pass: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.user || !credentials?.pass) return null;
        // Busca el par user:pass en AUTH_USERS
        const entry = usersEnv
          .split(',')
          .find((e) => e.startsWith(`${credentials.user}:`));
        if (!entry) return null;
        const [, storePass] = entry.split(':');
        // Compara contraseñas en texto plano
        if (credentials.pass !== storePass) return null;
        return { id: credentials.user, name: credentials.user };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
