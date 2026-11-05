import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../api/client";
import trophy from "../../assets/figma/achievement-trophy.svg";
import "./reward-notifications.css";

type Snapshot = {
  total_xp: number;
  earned: { code: string; name: string }[];
};
type Notice = { id: number; xp: number; names: string[] };

// Mounted once per account, outside route content. Never trust client reward claims.
export function RewardNotifications() {
  const previous = useRef<Snapshot | null>(null);
  const nextId = useRef(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    let active = true;
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const snapshot = await request<Snapshot>("/api/achievements/");
        if (!active) return;
        const before = previous.current;
        previous.current = snapshot;
        // First successful response establishes a baseline; old awards stay quiet.
        if (!before) return;
        const known = new Set(before.earned.map((award) => award.code));
        const names = snapshot.earned
          .filter((award) => !known.has(award.code))
          .map((award) => award.name);
        const xp = Math.max(0, snapshot.total_xp - before.total_xp);
        if (xp || names.length) {
          const notice = { id: ++nextId.current, xp, names };
          setNotices((items) => [...items, notice].slice(-5));
        }
      } catch {
        // A transient failure must not erase the last successful baseline.
      } finally {
        pending = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return (
    <aside className="reward-notifications" aria-label="Reward notifications">
      <div role="status" aria-live="polite" aria-atomic="true">
        {notices.map((notice) => (
          <section className="reward-toast" key={notice.id}>
            <img src={trophy} alt="" />
            <div>
              <strong>{notice.xp ? `+${notice.xp.toLocaleString("en-US")} XP earned!` : "Achievement unlocked!"}</strong>
              {notice.names.map((name) => <p key={name}>Trophy unlocked: {name}</p>)}
              <Link to="/achievements">View achievements</Link>
            </div>
            <button type="button" aria-label="Dismiss reward notification" onClick={() => setNotices((items) => items.filter((item) => item.id !== notice.id))}>×</button>
          </section>
        ))}
      </div>
    </aside>
  );
}
