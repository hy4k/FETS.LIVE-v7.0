import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useClients, useClientExams } from "../hooks/useClients";
import { supabase } from "../lib/supabase";
import { PlanningDialog } from "./PlanningDialog";
import "./planning-workspace.css";
import "./client-directory.css";
export const canManageClients = (profile: any) =>
  ["super_admin", "admin"].includes(profile?.role) ||
  profile?.email?.toLowerCase() === "mithun@fets.in";
export function ClientDirectory() {
  const { profile } = useAuth();
  const manage = canManageClients(profile);
  const qc = useQueryClient();
  const clients = useClients(),
    exams = useClientExams();
  const [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [exam, setExam] = useState(""),
    [search, setSearch] = useState(""),
    [locations, setLocations] = useState<string[]>(["calicut", "cochin"]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const rows = clients.data || [],
    programmes = exams.data || [];
  const active = rows.find((c) => c.id === selected) || rows[0];
  const save = async (kind: "client" | "exam") => {
    setError("");
    setMessage("");
    const value = (kind === "client" ? name : exam)
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
    if (!value || value.length > 120) {
      setError("Enter a name of 1–120 characters.");
      return;
    }
    if (kind === "exam" && !active) return;
    const duplicate =
      kind === "client"
        ? rows.some((c) => c.name.trim().toUpperCase() === value)
        : programmes.some(
            (e) =>
              e.client_id === active!.id &&
              e.name.trim().toUpperCase() === value,
          );
    if (duplicate) {
      setError("That name already exists in this catalogue.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } =
        kind === "client"
          ? await supabase
              .from("clients")
              .insert({ name: value, color: "teal" })
              .select()
              .single()
          : await supabase
              .from("client_exams")
              .insert({ client_id: active!.id, name: value, locations })
              .select()
              .single();
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["client_exams"] }),
      ]);
      if (kind === "client") {
        setSelected(data.id);
        setName("");
      } else setExam("");
      setMessage(
        `${value} saved. Available in Calendar and Candidate Tracker.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : (e as any)?.message || "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const filtered = rows.filter((c) =>
    `${c.name} ${programmes
      .filter((p) => p.client_id === c.id)
      .map((p) => p.name)
      .join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const activeProgrammes = programmes.filter((p) => p.client_id === active?.id);
  return (
    <div className="cd-workspace" data-client-workspace>
      <header className="cd-heading">
        <div>
          <span className="cd-eyebrow">CLIENT DIRECTORY</span>
          <h1>Clients & programmes</h1>
          <p>Manage providers and the exams offered at your centres.</p>
        </div>
        <div className="cd-summary">
          <strong>{rows.length}</strong> clients <span>·</span>{" "}
          <strong>{programmes.length}</strong> programmes
        </div>
      </header>
      {error && (
        <p role="alert" className="cd-feedback cd-failure">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="cd-feedback">
          {message}
        </p>
      )}
      {clients.isError || exams.isError ? (
        <div role="alert" className="cd-feedback cd-failure">
          Could not load the catalogue.{" "}
          <button
            onClick={() => {
              clients.refetch();
              exams.refetch();
            }}
          >
            Retry
          </button>
        </div>
      ) : clients.isLoading || exams.isLoading ? (
        <p role="status">Loading clients…</p>
      ) : (
        <>
          {manage && (
            <form
              className="cd-add-client"
              onSubmit={(e) => {
                e.preventDefault();
                save("client");
              }}
            >
              <div>
                <h2>Add a client</h2>
                <p>Use the provider name, such as PARAGON.</p>
              </div>
              <label>
                New client / provider
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Provider name"
                />
              </label>
              <button className="cd-primary" disabled={busy}>
                Add client
              </button>
            </form>
          )}
          <div className="cd-layout">
            <aside className="cd-sidebar">
              <label className="cd-search">
                Find a client or programme
                <input
                  aria-label="Find client"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search catalogue"
                />
              </label>
              <nav aria-label="Client list">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    className="cd-client"
                    aria-pressed={active?.id === c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setMessage("");
                      setError("");
                    }}
                  >
                    <span className="cd-monogram" aria-hidden="true">
                      {c.name.slice(0, 2)}
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {programmes.filter((e) => e.client_id === c.id).length}{" "}
                        programmes
                      </small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
                {!filtered.length && (
                  <p className="cd-empty">No matching clients.</p>
                )}
              </nav>
            </aside>
            <section className="cd-detail" aria-label="Client programmes">
              <header className="cd-detail-heading">
                <div>
                  <span className="cd-eyebrow">SELECTED CLIENT</span>
                  <h2>{active?.name || "No clients yet"}</h2>
                </div>
                <span className="cd-count">
                  {activeProgrammes.length} programme{activeProgrammes.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="cd-programmes">
                {activeProgrammes.map((e) => (
                  <article className="cd-programme" key={e.id}>
                    <span className="cd-exam-icon" aria-hidden="true">
                      ▤
                    </span>
                    <div>
                      <h3>{e.name}</h3>
                      <p>
                        {active?.name} → {e.name}
                      </p>
                      <div className="cd-locations">
                        {(e.locations?.length
                          ? e.locations
                          : ["all centres"]
                        ).map((l) => (
                          <span key={l}>
                            {l === "mobile"
                              ? "Mobile unit"
                              : l.charAt(0).toUpperCase() + l.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
                {!activeProgrammes.length && (
                  <div className="cd-empty">
                    <h3>No programmes recorded</h3>
                    <p>
                      {manage
                        ? "Add the first exam programme for this provider below."
                        : "Ask an administrator to add an exam programme."}
                    </p>
                  </div>
                )}
              </div>
              {manage && active && (
                <form
                  className="cd-programme-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save("exam");
                  }}
                >
                  <h3>Add a programme to {active.name}</h3>
                  <label>
                    New exam programme
                    <input
                      required
                      maxLength={120}
                      value={exam}
                      onChange={(e) => setExam(e.target.value)}
                      placeholder="Exam programme, e.g. CELPIP"
                    />
                  </label>
                  <fieldset>
                    <legend>Available centres</legend>
                    <div className="cd-checks">
                      {["calicut", "cochin", "mobile"].map((l) => (
                        <label key={l}>
                          <input
                            type="checkbox"
                            checked={locations.includes(l)}
                            onChange={() =>
                              setLocations(
                                locations.includes(l)
                                  ? locations.filter((x) => x !== l)
                                  : [...locations, l],
                              )
                            }
                          />
                          {l === "mobile"
                            ? "Mobile unit"
                            : l.charAt(0).toUpperCase() + l.slice(1)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="cd-primary" disabled={busy}>
                    Add programme
                  </button>
                </form>
              )}
            </section>
          </div>
          <footer className="cd-footer">
            One shared catalogue · Available in Calendar and Candidate Tracker.
            {!manage && " Ask an administrator to add clients or programmes."}
          </footer>
        </>
      )}
    </div>
  );
}

export function ClientDirectoryDialog({ onClose }: { onClose: () => void }) {
  return (
    <PlanningDialog title="Clients & programmes" onClose={onClose}>
      <ClientDirectory />
    </PlanningDialog>
  );
}
