"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useProfile } from "../layout";
import { fmtNum, isoDate } from "@/lib/format";

type Activity = { id: string; group_name: string; name: string; weight: number };
type ProfileRow = { id: string; full_name: string };

export default function EntryPage() {
  const profile = useProfile();
  const supabase = supabaseBrowser();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [team, setTeam] = useState<ProfileRow[]>([]);
  const [member, setMember] = useState(profile.id);
  const [date, setDate] = useState(isoDate(new Date()));
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: acts } = await supabase.from("activities").select("*").eq("active", true).order("sort_order");
      setActivities((acts as Activity[]) ?? []);
      if (profile.role === "gestor") {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").eq("role", "vendedor");
        setTeam((profs as ProfileRow[]) ?? []);
        if (profs && profs.length > 0) setMember(profs[0].id);
      } else {
        setTeam([{ id: profile.id, full_name: profile.full_name }]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!member || !date) return;
    (async () => {
      const { data } = await supabase
        .from("entries")
        .select("activity_id, quantity")
        .eq("user_id", member)
        .eq("entry_date", date);
      const v: Record<string, number> = {};
      (data ?? []).forEach((row: any) => (v[row.activity_id] = Number(row.quantity)));
      setValues(v);
      setSavedMsg(null);
    })();
  }, [member, date]);

  const grouped = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    activities.forEach((a) => {
      if (!groups[a.group_name]) groups[a.group_name] = [];
      groups[a.group_name].push(a);
    });
    return groups;
  }, [activities]);

  const total = activities.reduce((sum, a) => sum + (values[a.id] ?? 0) * a.weight, 0);

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    const rows = activities.map((a) => ({
      user_id: member,
      entry_date: date,
      activity_id: a.id,
      quantity: values[a.id] ?? 0,
    }));
    const { error } = await supabase.from("entries").upsert(rows, { onConflict: "user_id,entry_date,activity_id" });
    setSaving(false);
    if (error) {
      setSavedMsg("Não foi possível salvar. Tente novamente.");
      return;
    }
    const memberName = team.find((t) => t.id === member)?.full_name ?? "";
    setSavedMsg(`Lançamento salvo para ${memberName} — ${new Date(date + "T00:00:00").toLocaleDateString("pt-BR")}.`);
  }

  return (
    <div className="card">
      <h2>Lançar atividades do dia</h2>
      <div className="desc">
        {profile.role === "gestor" ? "Selecione o vendedor e a data." : "Seu lançamento diário."}
      </div>
      <div className="entry-head">
        <div className="field">
          <label>Vendedor</label>
          <select value={member} onChange={(e) => setMember(e.target.value)} disabled={profile.role !== "gestor"}>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {Object.entries(grouped).map(([groupName, items]) => (
        <div key={groupName}>
          <div className="group-title">{groupName}</div>
          {items.map((a) => (
            <div className="act-row" key={a.id}>
              <div className="act-name">{a.name}</div>
              <div className="act-weight">peso {a.weight}</div>
              <input
                type="number"
                min={0}
                step={1}
                value={values[a.id] ?? 0}
                onChange={(e) => setValues({ ...values, [a.id]: Number(e.target.value) || 0 })}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="entry-total">
        <span className="lbl">Total de pontos no dia</span>
        <span className="val">{fmtNum(total)}</span>
      </div>
      <button className="save-btn" onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Salvar lançamento"}
      </button>
      {savedMsg && <div className="save-msg">{savedMsg}</div>}
    </div>
  );
}
