import { createBrowserClient } from "@supabase/ssr";

// Usado em componentes de cliente ("use client").
// A sessão do usuário fica no cookie, então o servidor também sabe quem está logado.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
