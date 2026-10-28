import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Coffee,
  Inbox,
  Shuffle,
  UserRound,
  Headphones,
} from "lucide-react";
import SwapInvitations from "../desk-workspace/SwapInvitations";
import { tenure } from "../desk-workspace/model";
import HelpDesk from "../desk-workspace/HelpDesk";
import MyTime from "../desk-workspace/MyTime";
import type { TimeRepository } from "../desk-workspace/time-repository";
import "../desk-workspace/desk.css";
export type DeskPanel = "requests";
type Props = {
  user: {
    profileId?: string;
    id: string;
    name: string;
    role: string;
    branch: string;
    avatar?: string;
    joiningDate?: string;
  };
  navigate: (page: string) => void;
  renderPanel: (panel: DeskPanel, kind?: string) => React.ReactNode;
  timeRepository?: TimeRepository;
};
export default function MyDeskHome({
  user,
  navigate,
  renderPanel,
  timeRepository,
}: Props) {
  const [date, setDate] = useState(() => new Date()),
    [tab, setTab] = useState<"time" | "applications" | "help">("time"),
    [request, setRequest] = useState<string | null>(null);
  useEffect(() => {
    const tick = setInterval(() => setDate(new Date()), 30000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    setTab("time");
    setRequest(null);
    const open = (event: Event) => {
      if ((event as CustomEvent).detail === "requests") {
        setTab("applications");
        setRequest("all");
      }
    };
    const f = (window as any).FETS;
    if (f?._deskTab === "requests") {
      setTab("applications");
      setRequest("all");
    }
    if (f) f._deskTab = undefined;
    window.addEventListener("fets-desk-tab", open);
    return () => window.removeEventListener("fets-desk-tab", open);
  }, [user.id]);
  const days = tenure(user.joiningDate, date);
  const choices = [
    {
      kind: "leave",
      name: "Leave",
      hint: "Request a day off",
      icon: CalendarDays,
    },
    {
      kind: "halfday",
      name: "Half-day leave",
      hint: "First or second half of your shift",
      icon: Clock3,
    },
    {
      kind: "toil",
      name: "TOIL day off",
      hint: "Apply for time off in lieu",
      icon: Coffee,
    },
    {
      kind: "swap",
      name: "Shift swap",
      hint: "Swap with another staff member",
      icon: Shuffle,
    },
  ];
  return (
    <div className="personal-desk">
      <header className="pd-identity">
        <div>
          <span className="pd-eyebrow">
            {user.role} · {user.branch}
          </span>
          <h1>{user.name}</h1>
          <div className="pd-tenure">
            {days !== null ? (
              <>
                <strong>{days.toLocaleString("en-IN")}</strong>
                <span>
                  {days === 1 ? "day" : "days"} with FETS
                  <small>
                    Joined{" "}
                    {new Date(
                      user.joiningDate + "T00:00:00Z",
                    ).toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                </span>
              </>
            ) : (
              <span>
                Joining date not added
                <small>Ask management to add it in User Management.</small>
              </span>
            )}
          </div>
        </div>
        <div className="pd-heading-side">
          <span>
            {date.toLocaleDateString("en-GB", {
              timeZone: "Asia/Kolkata",
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <button className="pd-profile" onClick={() => navigate("profile")}>
            <UserRound size={16} />
            My profile
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>

      <div className="pd-desk-navigation">
        <h2>My Desk</h2>
        <nav aria-label="My Desk sections">
          {[
            { id: "time", label: "My time", icon: Clock3 },
            { id: "applications", label: "Applications", icon: Inbox },
            { id: "help", label: "Help desk", icon: Headphones },
          ].map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => {
                setTab(item.id as typeof tab);
                setRequest(null);
              }}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      {tab === "time" ? (
        <MyTime
          key={user.id}
          profileId={user.profileId}
          repository={timeRepository}
        />
      ) : tab === "help" ? (
        <HelpDesk navigate={navigate} />
      ) : (
        <section aria-label="Applications">
          <div className="pd-section-heading">
            <h3>Leave & shift changes</h3>
            <button
              className="pd-link"
              onClick={() => setRequest(request === null ? "all" : null)}
            >
              {request === null ? (
                <>
                  <Inbox size={16} />
                  History & approvals
                </>
              ) : (
                <>
                  <ArrowLeft size={16} />
                  Back to applications
                </>
              )}
            </button>
          </div>
          {request !== null ? (
            <div className="pd-requests">
              {renderPanel("requests", request === "all" ? undefined : request)}
            </div>
          ) : (
            <>
              <div className="pd-request-grid">
                {choices.map((item) => (
                  <button key={item.kind} onClick={() => setRequest(item.kind)}>
                    <item.icon size={21} strokeWidth={1.5} />
                    <ArrowUpRight className="pd-card-arrow" size={15} />
                    <strong>{item.name}</strong>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>
              <SwapInvitations key={user.id} profileId={user.profileId} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
