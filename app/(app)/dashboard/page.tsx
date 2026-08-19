"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/profileContext";
import { buildWeeks, fmtNum, FUNNEL_LABELS, FUNNEL_ORDER, weekDates, weekLabel } from "@/lib/format";

type Activity = { id: string; group_name: string; name: string; weight: number; active: boolean };
type EntryRow = { user_id: string; activity_id: string; quantity: number };
type ProfileRow = { id: string; full_name: string };

const WEEKS = buildWeeks();

export default function DashboardPage() {
  const profile = useProfile();
  const supabase = supabaseBrowser();

  const [week, setWeek] = useState(WEEKS[WEEKS.length - 1]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [team, setTeam] = useState<ProfileRow[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dates = weekDates(week);

      const { data: acts } = await supabase.from("activities").select("*").order("sort_order");
      setActivities((acts as Activity[]) ?? []);

      let entryQuery = supabase
        .from("entries")
        .select("user_id, activity_id, quantity")
        .gte("entry_date", dates[0])
        .lte("entry_date", dates[6]);
      const { data: ent } = await entryQuery;
      setEntries((ent as EntryRow[]) ?? []);

      if (profile.role === "gestor") {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").eq("role", "vendedor");
        setTeam((profs as ProfileRow[]) ?? []);
        const { data: m } = await supabase.from("metas").select("user_id, points_goal").is("week_start", null);
        const map: Record<string, number> = {};
        (m ?? []).forEach((row: any) => (map[row.user_id] = row.points_goal));
        setMetas(map);
      } else {
        setTeam([{ id: profile.id, full_name: profile.full_name }]);
        const { data: m } = await supabase
          .from("metas")
          .select("points_goal")
          .eq("user_id", profile.id)
          .is("week_start", null)
          .maybeSingle();
        setMetas({ [profile.id]: m?.points_goal ?? 0 });
      }
      setLoading(false);
    })();
  }, [week]);

  const weightById = useMemo(() => {
    const m: Record<string, number> = {};
    activities.forEach((a) => (m[a.id] = a.weight));
    return m;
  }, [activities]);

  const perUser = useMemo(() => {
    const map: Record<string, { totals: Record<string, number>; points: number }> = {};
    team.forEach((t) => (map[t.id] = { totals: {}, points: 0 }));
    entries.forEach((e) => {
      if (!map[e.user_id]) return;
      map[e.user_id].totals[e.activity_id] = (map[e.user_id].totals[e.activity_id] ?? 0) + Number(e.quantity);
      map[e.user_id].points += Number(e.quantity) * (weightById[e.activity_id] ?? 0);
    });
    return map;
  }, [entries, team, weightById]);

  if (loading) {
    return (
      <div className="card">
        <div className="empty-note">Carregando lançamentos…</div>
      </div>
    );
  }

  const periodLabel = weekLabel(week);

  const weekPicker = (
    <div className="field" style={{ marginBottom: 18 }}>
      <label>Semana</label>
      <select value={week} onChange={(e) => setWeek(e.target.value)}>
        {WEEKS.map((w) => (
          <option key={w} value={w}>
            {weekLabel(w)}
          </option>
        ))}
      </select>
    </div>
  );

  if (profile.role !== "gestor") {
    const mine = perUser[profile.id] ?? { totals: {}, points: 0 };
    const meta = metas[profile.id] ?? 0;
    const pct = meta > 0 ? Math.min(100, Math.round((mine.points / meta) * 100)) : null;

    return (
      <>
        {weekPicker}
        <div className="card">
          <h2>Seu desempenho</h2>
          <div className="desc">{periodLabel}</div>
          <div className="progress-hero">
            <div>
              <div className="num">{fmtNum(mine.points)}</div>
              <div className="lbl">Pontos na semana</div>
            </div>
            {meta > 0 ? (
              <div>
                <div className="num">{pct}%</div>
                <div className="lbl">Da sua meta ({fmtNum(meta)} pts)</div>
              </div>
            ) : (
              <div className="empty-note" style={{ padding: 0 }}>
                Sem meta definida pelo gestor ainda.
              </div>
            )}
          </div>
          {meta > 0 && (
            <div className="bar-track" style={{ marginTop: 14, height: 10 }}>
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="card">
          <h2>Seu funil</h2>
          <div className="desc">Da indicação ao fechamento</div>
          <div className="funnel">
            {FUNNEL_ORDER.map((id) => {
              const val = mine.totals[id] ?? 0;
              return (
                <div className="fun-row" key={id}>
                  <div className="fun-label">{FUNNEL_LABELS[id]}</div>
                  <div className="fun-bar-track">
                    <div className="fun-bar-fill" style={{ width: `${Math.min(100, val * 8)}%` }} />
                  </div>
                  <div className="fun-val">{fmtNum(val)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // gestor: full team
  const ranking = team
    .map((t) => ({ ...t, ...perUser[t.id] }))
    .sort((a, b) => b.points - a.points);
  const maxPts = Math.max(1, ...ranking.map((r) => r.points));
  const anyData = ranking.some((r) => r.points > 0);

  const funnelTotals: Record<string, number> = {};
  FUNNEL_ORDER.forEach((id) => (funnelTotals[id] = 0));
  ranking.forEach((r) => FUNNEL_ORDER.forEach((id) => (funnelTotals[id] += r.totals[id] ?? 0)));
  const maxFunnel = Math.max(1, ...FUNNEL_ORDER.map((id) => funnelTotals[id]));

  const prospecItems = activities.filter((a) => a.group_name === "Prospecção de canais");
  const prospecTotals = prospecItems
    .map((a) => ({ name: a.name, total: ranking.reduce((sum, r) => sum + (r.totals[a.id] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      {weekPicker}
      <div className="card">
        <h2>Ranking da semana</h2>
        <div className="desc">Pontuação total por peso de atividade — {periodLabel}</div>
        {anyData ? (
          <>
            <div className="board-row head">
              <div />
              <div>Vendedor</div>
              <div>Pontos</div>
              <div>Meta</div>
              <div>Desempenho</div>
            </div>
            {ranking.map((r, i) => {
              const meta = metas[r.id] ?? 0;
              const metaPct = meta > 0 ? Math.round((r.points / meta) * 100) : null;
              const pct = Math.round((r.points / maxPts) * 100);
              const totalActs = Object.values(r.totals).reduce((a, b) => a + b, 0);
              return (
                <div className="board-row" key={r.id}>
                  {i === 0 && r.points > 0 ? <div className="rank stamp">1º</div> : <div className="rank">{i + 1}º</div>}
                  <div className="name">
                    {r.full_name}
                    <span className="avg">{fmtNum(totalActs)} atividades na semana</span>
                  </div>
                  <div className="pts">{fmtNum(r.points)} pts</div>
                  <div className={`meta-pct ${metaPct !== null && metaPct >= 100 ? "hit" : ""}`}>
                    {metaPct !== null ? `${metaPct}% da meta` : "—"}
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="empty-note">Nenhum lançamento nesta semana ainda.</div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Funil de conversão</h2>
          <div className="desc">Da indicação ao fechamento — equipe toda</div>
          <div className="funnel">
            {FUNNEL_ORDER.map((id, i) => {
              const val = funnelTotals[id];
              const pct = Math.round((val / maxFunnel) * 100);
              const prev = i > 0 ? funnelTotals[FUNNEL_ORDER[i - 1]] : null;
              const rate = prev !== null ? (prev > 0 ? Math.round((val / prev) * 100) : 0) : null;
              return (
                <div key={id}>
                  <div className="fun-row">
                    <div className="fun-label">{FUNNEL_LABELS[id]}</div>
                    <div className="fun-bar-track">
                      <div className="fun-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="fun-val">{fmtNum(val)}</div>
                  </div>
                  {rate !== null && (
                    <div style={{ textAlign: "right", marginTop: -2 }}>
                      <span className="fun-conv">{rate}% do anterior</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h2>Canais de prospecção</h2>
          <div className="desc">Volume por canal, equipe toda</div>
          <table className="mini">
            <thead>
              <tr>
                <th>Canal</th>
                <th style={{ textAlign: "right" }}>Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {prospecTotals.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="num">{fmtNum(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
