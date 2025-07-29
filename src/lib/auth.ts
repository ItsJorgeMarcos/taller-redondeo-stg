import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const usersEnv = process.env.AUTH_USERS || '';

export const authOptions: AuthOptions = {
  // Usa la página de login en /login
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Usuario y Contraseña',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        // Busca entry “user:pass” en AUTH_USERS
        const entry = usersEnv
          .split(',')
          .find((e) => e.startsWith(`${credentials.username}:`));
        if (!entry) return null;
        const [, storePass] = entry.split(':');
        if (credentials.password !== storePass) return null;
        return { id: credentials.username, name: credentials.username };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
