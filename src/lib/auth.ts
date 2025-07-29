// src/lib/auth.ts

import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
        // Busca user:pass en AUTH_USERS (texto claro)
        const entry = usersEnv
          .split(',')
          .find((e) => e.startsWith(`${credentials.user}:`));
        if (!entry) return null;
        const [, storePass] = entry.split(':');
        if (credentials.pass !== storePass) return null;
        return { id: credentials.user, name: credentials.user };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
