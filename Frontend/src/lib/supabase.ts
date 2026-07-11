import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Fällt nur zur Laufzeit ohne .env.local auf; Build & Tests bleiben grün.
  // (createClient wirft bei leerer URL — daher Platzhalter statt "".)
  console.warn("Supabase: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen (.env.local).");
}

export const supabase = createClient(url || "http://localhost:54321", anonKey || "placeholder-anon-key");
