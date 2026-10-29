import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
const hours = (cell: any) =>
  cell
    ? `${cell.shift_code} ${cell.shift_start?.slice(0, 5) || ""}${cell.shift_end ? "–" + cell.shift_end.slice(0, 5) : ""}`
    : "Not available";
export default function SwapInvitations({ profileId }: { profileId?: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0),
    mounted = useRef(true);
  const load = async () => {
    if (!profileId) return;
    const request = ++generation.current;
    try {
      const { data, error } = await supabase
        .from("staff_applications")
        .select(
          "id,version,applicant_name,request_date,swap_date,partner_reply,workflow_version,roster_snapshot",
        )
        .eq("swap_with_id", profileId)
        .eq("status", "pending")
        .eq("workflow_version", 1)
        .is("partner_reply", null);
      if (request !== generation.current || !mounted.current) return;
      if (error) throw error;
      setRows(data || []);
      setError("");
    } catch {
      if (request === generation.current && mounted.current)
        setError("Swap invitations could not be loaded.");
    }
  };
  useEffect(() => {
    mounted.current = true;
    setRows([]);
    void load();
    const h = () => void load();
    window.addEventListener("fets-applications-changed", h);
    const id = setInterval(h, 60000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(id);
      window.removeEventListener("fets-applications-changed", h);
    };
  }, [profileId]);
  const reply = async (row: any, accept: boolean) => {
    setBusy(row.id);
    try {
      const { error } = await supabase.rpc("desk_swap_reply", {
        p_id: row.id,
        p_accept: accept,
        p_version: row.version,
      });
      if (error) throw error;
      if (mounted.current) {
        await load();
        window.dispatchEvent(new Event("fets-applications-changed"));
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not save your reply. Please retry.",
        );
    } finally {
      if (mounted.current) setBusy("");
    }
  };
  if (!rows.length && !error) return null;
  return (
    <section className="pd-invitations" aria-label="Swap invitations">
      {error && (
        <p role="alert">
          {error}
          <button className="pd-link" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {rows.map((row) => (
        <article key={row.id}>
          <div>
            <strong>{row.applicant_name} proposed a shift swap</strong>
            <p>Your saved shifts would change as follows:</p>
            {[...new Set([row.request_date, row.swap_date])].map((day: any) => {
              const own = row.roster_snapshot?.find(
                  (c: any) => c.profile_id === profileId && c.date === day,
                ),
                other = row.roster_snapshot?.find(
                  (c: any) => c.profile_id !== profileId && c.date === day,
                );
              return (
                <p key={day}>
                  {day}: {hours(own)} → {hours(other)}
                </p>
              );
            })}
            <p>Your agreement still needs management approval.</p>
          </div>
          <button
            className="pd-primary"
            disabled={!!busy}
            onClick={() => void reply(row, true)}
          >
            Agree to swap
          </button>
          <button
            className="pd-link"
            disabled={!!busy}
            onClick={() => void reply(row, false)}
          >
            Decline
          </button>
        </article>
      ))}
    </section>
  );
}
