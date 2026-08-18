"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Profile = { id: string; full_name: string; role: "gestor" | "vendedor" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data as Profile);
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading || !profile) {
    return (
      <div className="wrap">
        <div className="empty-note">Carregando…</div>
      </div>
    );
  }

  const tabs =
    profile.role === "gestor"
      ? [
          { href: "/dashboard", label: "Painel da equipe" },
          { href: "/entry", label: "Lançar atividades" },
          { href: "/settings", label: "Configurações" },
        ]
      : [
          { href: "/dashboard", label: "Meu desempenho" },
          { href: "/entry", label: "Lançar atividades" },
        ];

  return (
    <div className="wrap">
      <div className="masthead">
        <div className="eyebrow">Livro de Desempenho &middot; Equipe Consórcio</div>
        <h1>Rotina Semanal</h1>
        <div className="sub">
          {profile.full_name} · {profile.role === "gestor" ? "gestor" : "vendedor"}
        </div>
        <div className="month">
          <button className="signout" onClick={signOut}>
            Sair
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <ProfileContext value={profile}>{children}</ProfileContext>
    </div>
  );
}

// Contexto simples pra páginas filhas saberem quem está logado sem refazer a consulta
import { createContext, useContext } from "react";
const Ctx = createContext<Profile | null>(null);
function ProfileContext({ value, children }: { value: Profile; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile precisa estar dentro do AppLayout");
  return ctx;
}
