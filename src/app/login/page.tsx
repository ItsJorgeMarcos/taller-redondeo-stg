'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });
    if (res?.error) setError('Credenciales incorrectas');
    else window.location.href = '/calendar';
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAEDEB]">
      <h1 className="text-xl font-semibold text-[#F0816C]">Acceso al Taller</h1>
      <form
        className="flex flex-col items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          className="w-72 rounded border p-2"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          className="w-72 rounded border p-2"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPass(e.target.value)}
        />
        <button
          type="submit"
          className="w-72 rounded bg-[#F0816C] px-4 py-2 text-white hover:bg-[#e67061] transition"
        >
          Entrar
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
