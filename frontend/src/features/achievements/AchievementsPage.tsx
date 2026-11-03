import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../api/client";
import { useProfile } from "../profile/context";
import trophy from "../../assets/figma/achievement-trophy.svg";
import "./achievements.css";

type EarnedAchievement = {
  code: string;
  name: string;
  description: string;
  xp: number;
  repeat_xp?: number;
  earned_at: string;
};
type Collection = {
  total_xp: number;
  total_achievements: number;
  earned: EarnedAchievement[];
};

export function AchievementsPage() {
  const { registered, loading: identityLoading } = useProfile();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    if (!registered) return;
    let active = true;
    request<Collection>("/api/achievements/")
      .then((value) => {
        if (active) setCollection(value);
      })
      .catch(() => {
        if (active)
          setError("We could not load your achievements. Please try again.");
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [registered, attempt]);
  const refresh = () => {
    setError("");
    setPending(true);
    setAttempt((n) => n + 1);
  };
  return (
    <section className="achievements-page">
      <div className="page-intro">
        <span className="eyebrow">MILESTONES THAT MATTER</span>
        <h1>Make every session count.</h1>
        <p className="muted">
          Discover your collection through play and good company.
        </p>
      </div>
      {identityLoading ? (
        <p role="status">Checking your account…</p>
      ) : !registered ? (
        <div className="notice">
          Sign in with a registered account to collect achievements.{" "}
          <Link to="/login">Sign in</Link>
        </div>
      ) : error ? (
        <div className="notice error-notice" role="alert">
          {error}{" "}
          <button className="text-button" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : pending ? (
        <p role="status">Loading your collection…</p>
      ) : (
        collection && (
          <>
            <section
              className="panel collection-summary"
              aria-label="Your collection"
            >
              <h2>Your collection</h2>
              <dl>
                <div>
                  <dt>Achievements earned</dt>
                  <dd>
                    {collection.earned.length} / {collection.total_achievements}
                  </dd>
                </div>
                <div>
                  <dt>Total XP</dt>
                  <dd>{collection.total_xp.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt>Achievement XP</dt>
                  <dd>
                    {collection.earned
                      .reduce((sum, a) => sum + a.xp, 0)
                      .toLocaleString("en-US")}
                  </dd>
                </div>
              </dl>
            </section>
            <div className="collection-heading">
              <h2>Your trophies</h2>
              <button className="text-button" onClick={refresh}>
                Refresh collection
              </button>
            </div>
            <div className="achievement-grid">
              {collection.earned.map((achievement) => (
                <article
                  className="panel achievement-card earned"
                  key={achievement.code}
                >
                  <div className="achievement-emblem">
                    <img src={trophy} alt="" />
                    <span>Earned</span>
                  </div>
                  <div>
                    <h3>{achievement.name}</h3>
                    <p className="muted">{achievement.description}</p>
                  </div>
                  <p className="achievement-xp">
                    +{achievement.xp} XP
                    {achievement.repeat_xp
                      ? ` · +${achievement.repeat_xp} XP on repeat wins`
                      : ""}
                  </p>
                  <p className="field-hint">
                    Unlocked{" "}
                    <time dateTime={achievement.earned_at}>
                      {new Date(achievement.earned_at).toLocaleDateString()}
                    </time>{" "}
                    · XP added to your total
                  </p>
                </article>
              ))}
              {Array.from(
                {
                  length: Math.max(
                    0,
                    collection.total_achievements - collection.earned.length,
                  ),
                },
                (_, index) => (
                  <article
                    className="panel achievement-card hidden-achievement"
                    key={`hidden-${index}`}
                  >
                    <div className="achievement-emblem">
                      <img src={trophy} alt="" />
                      <span>Undiscovered</span>
                    </div>
                    <div>
                      <h3>Hidden achievement</h3>
                      <p className="muted">
                        There is more to discover. Keep exploring RIVR.
                      </p>
                    </div>
                    <p className="achievement-xp">+50 XP</p>
                    <p className="field-hint">Revealed when you earn it.</p>
                  </article>
                ),
              )}
            </div>
            <p className="notice">
              Trophies unlock once. Hand wins earn 100 XP and tournament wins
              earn 1,000 XP each. Some earned trophies also award repeat XP.
              Awards can stack. Split pots do not count as wins.
            </p>
          </>
        )
      )}
    </section>
  );
}
