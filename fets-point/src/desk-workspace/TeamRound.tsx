import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, RefreshCw, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { indiaDay, roundFor } from "./model";
export type RoundState = {
  day: string;
  choice: number | null;
  participants: { name: string }[];
};
export const teamRoundRepository = {
  async load(): Promise<RoundState> {
    const { data, error } = await supabase.rpc("desk_team_round");
    if (error) throw error;
    return data;
  },
  async join(choice: number, day: string): Promise<RoundState> {
    const { data, error } = await supabase.rpc("desk_team_round_join", {
      p_choice: choice,
      p_day: day,
    });
    if (error) throw error;
    return data;
  },
};
export default function TeamRound({
  repository = teamRoundRepository,
}: {
  repository?: typeof teamRoundRepository;
}) {
  const [state, setState] = useState<RoundState | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(0),
    saving = useRef(false),
    alive = useRef(true);
  const load = async () => {
    if (saving.current) return;
    const id = ++request.current;
    try {
      const s = await repository.load();
      if (id === request.current) {
        setState(s);
        setError("");
      }
    } catch {
      if (id === request.current)
        setError("The team round is unavailable. Try again.");
    }
  };
  useEffect(() => {
    alive.current = true;
    setState(null);
    setSelected(null);
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      alive.current = false;
      request.current++;
      clearInterval(id);
    };
  }, [repository]);
  const day = state?.day || indiaDay(),
    round = roundFor(day),
    joined = state?.choice !== null && state?.choice !== undefined;
  const submit = async () => {
    if (selected === null || !state) return;
    setBusy(true);
    saving.current = true;
    request.current++;
    setError("");
    try {
      const next = await repository.join(selected, day);
      if (alive.current) setState(next);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your answer. Try again.",
      );
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section className="pd-round" aria-labelledby="team-round-title">
      <header>
        <div>
          <span className="pd-eyebrow">ONE MINUTE · TOGETHER</span>
          <h2 id="team-round-title">The team round</h2>
        </div>
        <span className="pd-round-symbol" aria-hidden="true">
          ✳
        </span>
      </header>
      <p className="pd-round-intro">
        A small communication challenge for everyone at FETS.
      </p>
      {!state && !error ? (
        <p role="status">Loading today’s round…</p>
      ) : (
        <>
          <span className="pd-round-title">{round.title}</span>
          <h3>{round.question}</h3>
          <div className="pd-round-options">
            {round.options.map((option, index) => (
              <button
                key={option}
                disabled={joined || busy || !state}
                aria-pressed={
                  joined ? state.choice === index : selected === index
                }
                onClick={() => setSelected(index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
                {joined && index === round.answer && <Check size={16} />}
              </button>
            ))}
          </div>
          {joined ? (
            <div className="pd-round-result">
              <strong>
                {state.choice === round.answer
                  ? "You found it."
                  : "A useful way to think about it."}
              </strong>
              <p>{round.why}</p>
              <small>Today’s round complete. A new one opens tomorrow.</small>
            </div>
          ) : (
            <button
              className="pd-primary"
              onClick={submit}
              disabled={selected === null || busy || !state}
            >
              {busy ? "Saving…" : "Join today’s round"}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert">
          {error}
          <button className="pd-link" onClick={() => void load()}>
            <RefreshCw size={13} />
            Retry
          </button>
        </p>
      )}
      <footer>
        <Users size={16} />
        <span>
          {state
            ? `${state.participants.length} ${state.participants.length === 1 ? "person has" : "people have"} joined today`
            : "Team progress unavailable"}
          {state && state.participants.length > 0 && (
            <small>{state.participants.map((p) => p.name).join(" · ")}</small>
          )}
        </span>
      </footer>
      <p className="pd-round-note">
        Optional · Your answer stays private · No staff ranking
      </p>
    </section>
  );
}
