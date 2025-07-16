import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

type UserRec = { email: string; hash: string };

function loadUsers(): UserRec[] {
  return (process.env.AUTH_USERS ?? "")
    .split(",")
    .filter(Boolean)
    .map((pair) => {
      const [email, hash] = pair.split(":");
      return { email, hash };
    });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Login Taller",
      credentials: {
        email: { label: "E‑mail", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(creds) {
        if (!creds) return null;
        const user = loadUsers().find((u) => u.email === creds.email);
        if (!user) return null;
        const ok = bcrypt.compareSync(creds.password, user.hash);
        return ok ? { id: user.email, email: user.email } : null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
