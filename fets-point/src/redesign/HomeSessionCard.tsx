import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
export default function HomeSessionCard({
  sessions,
  loading,
  error,
  onOpen,
}: {
  sessions: any[] | null;
  loading: boolean;
  error: boolean;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [focused, setFocused] = useState(false),
    [hidden, setHidden] = useState(() => document.hidden);
  const items = (sessions || []).filter(
    (s) =>
      !["cancelled", "canceled"].includes(String(s.status || "").toLowerCase()),
  );
  const candidateTotal = items.length && items.every(s => s.candidate_count !== null && s.candidate_count !== undefined && Number.isFinite(Number(s.candidate_count)))
    ? items.reduce((total, s) => total + Number(s.candidate_count), 0) : null;
  const formatTime = (value?: string) => {
    if (!value) return "Time TBC";
    const match = /^(\d{2}):(\d{2})/.exec(value);
    if (!match) return "Time TBC";
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
  };
  const item = items[index % Math.max(items.length, 1)];
  const duration = Math.max(
    7000,
    Math.min(
      14000,
      `${item?.client_name || ""} ${item?.exam_name || ""}`.length * 110 + 4500,
    ),
  );
  const stopped = paused || hover || focused || hidden || !!reduce;
  useEffect(() => {
    setIndex(0);
  }, [sessions]);
  useEffect(() => {
    const h = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);
  useEffect(() => {
    if (stopped || items.length < 2 || loading) return;
    const id = setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      duration,
    );
    return () => clearTimeout(id);
  }, [index, stopped, items.length, duration, loading]);
  const next = (delta: number) =>
    setIndex((i) => (i + delta + items.length) % items.length);
  return (
    <section
      className="fs-session-card"
      aria-label="Today’s sessions"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <header>
        <div><span className="fs-session-eyebrow">TODAY · IST</span><h2>Today’s sessions</h2></div>
        <button onClick={onOpen} aria-label="Open calendar">Calendar <ArrowUpRight size={15} /></button>
      </header>
      {!loading && !error && items.length > 0 && <div className="fs-session-totals"><span><strong>{items.length}</strong> {items.length === 1 ? "session" : "sessions"}</span>{candidateTotal !== null && <span><strong>{candidateTotal}</strong> scheduled candidates</span>}</div>}
      <div className="fs-session-stage" aria-live={stopped ? "polite" : "off"}>
        {loading ? (
          <p>Loading sessions…</p>
        ) : error ? (
          <p>
            Calendar unavailable.<button onClick={onOpen}>Open calendar</button>
          </p>
        ) : !item ? (
          <p>No sessions scheduled today.</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={item.id}
              initial={
                reduce
                  ? false
                  : { opacity: 0, y: 14, rotateX: 12, filter: "blur(3px)" }
              }
              animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -10, rotateX: -8, filter: "blur(2px)" }
              }
              transition={{
                duration: reduce ? 0 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="fs-session-copy"
            >
              <div className="fs-session-title"><span className="fs-session-client">{item.client_name || "Exam session"}</span><strong>{item.exam_name || "Programme not specified"}</strong></div>
              <div className="fs-session-details">
                <div><Clock3 size={17} /><span><small>Session time</small><b>{formatTime(item.start_time)}{item.end_time ? " – " + formatTime(item.end_time) : ""}</b></span></div>
                <div><MapPin size={17} /><span><small>Centre</small><b>{item.branch_location || "Centre not specified"}</b></span></div>
                <div><Users size={17} /><span><small>Candidates</small><b>{item.candidate_count ?? "Not entered"}</b></span></div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <footer>
        <span>
          {items.length
            ? `${(index % items.length) + 1} / ${items.length}`
            : "Calendar · IST"}{item?.status && <span className="fs-session-status">{item.status}</span>}
        </span>
        <div>
          <button
            aria-label="Previous session"
            onClick={() => { setPaused(true); next(-1); }}
            disabled={items.length < 2}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            aria-label={paused ? "Play sessions" : "Pause sessions"}
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            disabled={items.length < 2 || !!reduce}
          >
            {paused || reduce ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            aria-label="Next session"
            onClick={() => { setPaused(true); next(1); }}
            disabled={items.length < 2}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </footer>
      {items.length > 1 && (
        <div className="fs-session-progress" aria-hidden="true">
          <span
            key={`${index}-${duration}-${stopped}`}
            style={{
              animationDuration: duration + "ms",
              animationPlayState: stopped ? "paused" : "running",
              opacity: stopped ? 0.25 : 1,
            }}
          />
        </div>
      )}
    </section>
  );
}
