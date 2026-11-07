import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  MessagesSquare,
} from "lucide-react";
import MissionWorkspace from "./MissionWorkspace";
import "./client-actionables.css";
const PrometricWorkspace = lazy(() => import("../outreach/PrometricWorkspace"));
type Client = "pearson" | "prometric" | null;
const readClient = (): Client => {
  const value = new URLSearchParams(window.location.search).get("client");
  return value === "pearson" || value === "prometric" ? value : null;
};
export function ActionablesView({
  clientMenu = true,
}: {
  branch?: string;
  navigate?: (page: string) => void;
  clientMenu?: boolean;
}) {
  const [client, setClient] = useState<Client>(readClient);
  useEffect(() => {
    const changed = () => setClient(readClient());
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  const choose = (value: Client) => {
    setClient(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("client", value);
    else url.searchParams.delete("client");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  };
  if (!clientMenu) return <MissionWorkspace />;
  if (client === "prometric")
    return (
      <Suspense
        fallback={
          <div className="client-actionables" role="status">
            Opening Prometric institute partnerships…
          </div>
        }
      >
        <PrometricWorkspace onBack={() => choose(null)} />
      </Suspense>
    );
  if (client === "pearson")
    return (
      <div className="client-pearson-workspace">
        <button
          type="button"
          className="client-back"
          onClick={() => choose(null)}
        >
          <ArrowLeft size={16} />
          All clients
        </button>
        <MissionWorkspace />
      </div>
    );
  return (
    <section className="client-actionables" aria-label="Actionables clients">
      <header>
        <p>FETS / Actionables</p>
        <h1>Choose your client workspace.</h1>
        <span>
          Keep each partnership’s conversations, work and next steps together.
        </span>
      </header>
      <div className="client-actionable-boxes">
        <button
          type="button"
          className="client-actionable-box client-pearson"
          onClick={() => choose("pearson")}
        >
          <span className="client-box-icon">
            <Building2 size={26} />
            <ArrowUpRight size={22} />
          </span>
          <h2>Pearson VUE</h2>
          <strong>Centre partnerships</strong>
          <p>Your existing institutions, stages, duties and delivery work.</p>
          <span className="client-box-open">Open workspace</span>
        </button>
        <button
          type="button"
          className="client-actionable-box client-prometric"
          onClick={() => choose("prometric")}
        >
          <span className="client-box-icon">
            <MessagesSquare size={26} />
            <ArrowUpRight size={22} />
          </span>
          <h2>Prometric</h2>
          <strong>CMA institute relationships</strong>
          <p>
            Consultative calls, clear follow-ups and mock-exam candidate
            partnerships.
          </p>
          <span className="client-box-open">Open workspace</span>
        </button>
      </div>
    </section>
  );
}
export default ActionablesView;
