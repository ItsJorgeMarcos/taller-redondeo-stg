"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Acceso al Taller</h1>

      <input
        className="w-72 rounded border p-2"
        placeholder="E‑mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-72 rounded border p-2"
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPass(e.target.value)}
      />

      <button
        className="rounded bg-sky-500 px-4 py-2 text-white"
        onClick={async () => {
          const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (res?.error) setError("Credenciales incorrectas");
          else window.location.href = "/calendar";
        }}
      >
        Entrar
      </button>

      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
