// src/lib/kv.ts
import { createClient } from '@vercel/kv';

export const kv = createClient({
  // Define estas vars en Vercel o tu .env.local
  url: process.env.VERCEL_KV_URL!,
  token: process.env.VERCEL_KV_TOKEN!,
});
