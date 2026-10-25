import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import {
  centreDate,
  loadHomeSessions,
  loadOperationsSnapshot,
  type OperationsSnapshot,
} from "./operations-data";
import "./operations-home.css";
import "./fets-space-home.css";
import HomeSessionCard from "./HomeSessionCard";
import { Building2, MessagesSquare, Newspaper, Layers } from "lucide-react";
import { PersonalHero } from "./BrandExperience";

type Props = {
  userName?: string;
  branch: string;
  navigate: (page: string) => void;
  openDrawer: (drawer: string) => void;
  homeAccess?: string[];
  load?: typeof loadOperationsSnapshot;
};
const empty: OperationsSnapshot = {
  sessions: null,
  roster: null,
  attendance: null,
  handovers: null,
  failures: [],
  updatedAt: "",
};
export default function OperationsHome({
  userName = "Welcome",
  branch,
  navigate,
  openDrawer,
  homeAccess = ["fets-chat"],
  load = loadHomeSessions,
}: Props) {
  const [snapshot, setSnapshot] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const request = useRef(0);
  const date = centreDate(now);
  const label = ["all", "global"].includes(branch)
    ? "All centres"
    : branch.charAt(0).toUpperCase() + branch.slice(1);
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(new Date());
      if (document.visibilityState === "visible") setRefresh((n) => n + 1);
    }, 60000);
    const refreshData = () => setRefresh((n) => n + 1);
    window.addEventListener("fets-roster-changed", refreshData);
    window.addEventListener("fets-data-loaded", refreshData);
    return () => {
      clearInterval(tick);
      window.removeEventListener("fets-roster-changed", refreshData);
      window.removeEventListener("fets-data-loaded", refreshData);
    };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setSnapshot(empty);
    load(branch, date)
      .then((data) => {
        if (request.current === id) setSnapshot(data);
      })
      .catch(() => {
        if (request.current === id)
          setSnapshot({ ...empty, failures: ["Operations data"] });
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [branch, date, refresh, load]);
  const tools = [
    {
      id: "system-manager",
      label: "FETS SITES",
      hint: "Test centre administration",
      icon: Building2,
    },
    {
      id: "fets-chat",
      label: "TEAM SPACE",
      hint: "Team chat and collaboration",
      icon: MessagesSquare,
    },
    {
      id: "news-manager",
      label: "FETS NEWS",
      hint: "News and announcements",
      icon: Newspaper,
    },
    {
      id: "fets-space",
      label: "FETS SPACE",
      hint: "Workspace setup to follow",
      icon: Layers,
    },
  ];
  return (
    <div className="operations-home">
      <PersonalHero
        name={userName}
        branch={label}
        onDesk={() => navigate("desk")}
      />
      <div className="oh-overview-heading">
        <h2>Fets Space</h2>
        <button
          className="oh-icon-button"
          onClick={() => setRefresh((n) => n + 1)}
          aria-label="Refresh sessions"
          disabled={loading}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <section className="fs-tools" aria-label="Fets Space tools">
        {tools.map((t) => (
          <button
            key={t.id}
            disabled={!homeAccess.includes(t.id)}
            onClick={() => navigate(t.id)}
          >
            <t.icon size={25} strokeWidth={1.4} />
            <ArrowUpRight size={16} className="fs-tool-arrow" />
            <strong>{t.label}</strong>
            <small>
              {homeAccess.includes(t.id) ? t.hint : "Administrator access"}
            </small>
          </button>
        ))}
      </section>
      <div className="fs-session-row">
        <HomeSessionCard
          sessions={snapshot.sessions}
          loading={loading}
          error={!loading && snapshot.sessions === null}
          onOpen={() => navigate("calendar")}
        />
      </div>
      <footer className="oh-footer">
        <span>{label} · Calendar times in IST</span>
        <span>
          {snapshot.updatedAt
            ? `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`
            : ""}
        </span>
      </footer>
    </div>
  );
}
