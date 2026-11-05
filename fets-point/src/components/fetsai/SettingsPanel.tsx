import { useEffect, useState } from "react";
import { Power, Cpu, Loader2, AlertTriangle } from "lucide-react";
import {
  type AgentSettings,
  type AgentStatus,
} from "../../fets-ai/fets-ai-api";
import { useAgentResource } from "../../fets-ai/useAgentResource";
export function SettingsPanel({
  isAdmin,
  userId,
  branch,
  onStatus,
}: {
  isAdmin: boolean;
  userId: string;
  branch: string;
  onStatus?: (s: AgentStatus) => void;
}) {
  const resource = useAgentResource<AgentStatus>(userId, branch, "status"),
    status = resource.data,
    settings = status?.settings;
  const [model, setModel] = useState("");
  useEffect(() => {
    setModel(
      settings
        ? settings.provider === "claude"
          ? settings.claude_model
          : settings.gemini_model
        : ""
    );
    if (status) onStatus?.(status);
  }, [status]);
  const patch = async (changes: Partial<AgentSettings>) => {
    await resource.mutate<AgentStatus>(
      { action: "settings-update", changes },
      (_, result) => result
    );
  };
  if (resource.loading)
    return <p className="text-sm p-4 text-slate-500">Loading settings…</p>;
  if (!settings)
    return (
      <div role="alert">
        {resource.error || "Settings unavailable."}
        <button onClick={resource.load}>Retry</button>
      </div>
    );
  const canEdit = isAdmin && status.admin,
    writesOn = Boolean(status.writesEnabled);
  return (
    <div className="space-y-4 max-w-2xl">
      {resource.error && (
        <div role="alert" className="text-rose-700">
          {resource.error}
          <button onClick={resource.load}>Retry</button>
        </div>
      )}
      {!canEdit && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
          <AlertTriangle size={14} />
          Read-only — only admins can change these.
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex gap-2 items-center">
              <Power size={16} />
              <strong>Autonomous Writes</strong>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              When ON, explicit permitted case, task and calendar requests can
              save records. Role and centre access still apply. OFF blocks
              operational writes on the server.
            </p>
          </div>
          <button
            role="switch"
            aria-label="Autonomous Writes"
            aria-checked={writesOn}
            disabled={!canEdit || resource.saving}
            onClick={() =>
              patch({ kill_switch: writesOn, autonomous_enabled: !writesOn })
            }
            className={`relative w-16 h-8 rounded-full shrink-0 disabled:opacity-40 ${
              writesOn ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 bg-white rounded-full ${
                writesOn ? "left-9" : "left-1"
              }`}
            />
          </button>
        </div>
        <p
          className={`mt-3 text-xs font-bold ${
            writesOn ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {writesOn
            ? "Live — writes enabled"
            : "Read-only — operational writes disabled"}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Allowed actions: {status.allowedActions?.join(", ") || "None"}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex gap-2 mb-3">
          <Cpu size={16} />
          <strong>Model Provider</strong>
          {resource.saving && <Loader2 size={16} className="animate-spin" />}
        </div>
        <div className="flex gap-2">
          {(["claude", "gemini"] as const).map((p) => (
            <div className="flex-1" key={p}>
              <button
                className={`w-full rounded-xl border p-3 text-sm font-bold disabled:opacity-40 ${
                  settings.provider === p
                    ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                    : ""
                }`}
                disabled={!canEdit || resource.saving || !status.providers?.[p]}
                onClick={() => patch({ provider: p })}
              >
                {p === "claude" ? "Claude (Anthropic)" : "Gemini (Google)"}
              </button>
              {!status.providers?.[p] && (
                <p className="text-xs text-amber-700 mt-1">
                  Server credential unavailable
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs mt-3">
          Active model: <span className="font-mono">{status.textModel}</span>
        </p>
        <p className="text-xs text-slate-500">
          Live model: {status.liveModel || "Unavailable"}
        </p>
        {canEdit && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              patch(
                settings.provider === "gemini"
                  ? { gemini_model: model.trim() }
                  : { claude_model: model.trim() }
              );
            }}
          >
            <label className="text-xs">
              Configured model
              <input
                aria-label="Configured model"
                className="block border rounded-lg p-2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
            <button
              disabled={resource.saving || !model.trim()}
              className="text-sm text-indigo-700"
            >
              Save model
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
