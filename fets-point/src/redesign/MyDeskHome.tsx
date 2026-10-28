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
} from "lucide-react";
import type { DeskRepository } from "./desk-data";
import TeamRound from "../desk-workspace/TeamRound";
import SwapInvitations from "../desk-workspace/SwapInvitations";
import { tenure, indiaDay } from "../desk-workspace/model";
import HelpDesk from "../desk-workspace/HelpDesk";
import "../desk-workspace/desk.css";
export type DeskPerson = {
  id: string;
  full_name: string;
  branch_assigned?: string;
  avatar_url?: string;
};
export type DeskPanel =
  | "time"
  | "handovers"
  | "checklist"
  | "growth"
  | "requests";
type Props = {
  canAccessHub?: boolean;
  repository?: DeskRepository;
  user: {
    profileId?: string;
    id: string;
    name: string;
    role: string;
    branch: string;
    avatar?: string;
    joiningDate?: string;
  };
  people: DeskPerson[];
  pendingHandovers: number | null;
  navigate: (page: string) => void;
  openDrawer: (drawer: string) => void;
  openChat: (person: DeskPerson) => void;
  renderPanel: (panel: DeskPanel, kind?: string) => React.ReactNode;
  roundRepository?: React.ComponentProps<typeof TeamRound>["repository"];
};
export default function MyDeskHome({
  user,
  navigate,
  renderPanel,
  roundRepository,
}: Props) {
  const [date, setDate] = useState(() => new Date()),
    [request, setRequest] = useState<string | null>(null);
  useEffect(() => {
    const tick = setInterval(() => setDate(new Date()), 30000);
    const open = (event: Event) => {
      if ((event as CustomEvent).detail === "requests") setRequest("all");
    };
    window.addEventListener("fets-desk-tab", open);
    const asked = (window as any).FETS?._deskTab;
    if (asked === "requests") setRequest("all");
    return () => {
      clearInterval(tick);
      window.removeEventListener("fets-desk-tab", open);
    };
  }, []);
  useEffect(() => {
    setRequest((window as any).FETS?._deskTab === "requests" ? "all" : null);
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
      hint: "Choose the first or second half",
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
      hint: "Arrange a swap with a teammate",
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
                <small>Update your staff record in User Management.</small>
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
      <div className="pd-section-heading">
        <h2>My Desk</h2>
        <button
          className="pd-link"
          onClick={() => setRequest(request === null ? "all" : null)}
        >
          {request === null ? (
            <>
              <Inbox size={16} />
              Requests & approvals
            </>
          ) : (
            <>
              <ArrowLeft size={16} />
              Back to My Desk
            </>
          )}
        </button>
      </div>
      {request !== null ? (
        <section className="pd-requests" aria-label="Applications">
          {renderPanel("requests", request === "all" ? undefined : request)}
        </section>
      ) : (
        <>
          <section className="pd-request-grid" aria-label="Applications">
            {choices.map((item) => (
              <button key={item.kind} onClick={() => setRequest(item.kind)}>
                <item.icon size={21} strokeWidth={1.5} />
                <ArrowUpRight className="pd-card-arrow" size={15} />
                <strong>{item.name}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
          </section>
          <SwapInvitations key={user.id} profileId={user.profileId} />
          <div className="pd-content">
            <TeamRound
              key={user.id + indiaDay(date)}
              repository={roundRepository}
            />
            <HelpDesk navigate={navigate} />
          </div>
        </>
      )}
    </div>
  );
}
