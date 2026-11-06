/**
 * Module: achievements/AchievementsPage.tsx.
 * Render the achievements screen, including user actions, loading states and request feedback.
 */
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

/** Render the achievements page interface and its current state. */
export function AchievementsPage() {
  const { registered, loading: identityLoading } = useProfile();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    if (!registered) return;
    let active = true;
    request<Collection>("/api/achievements/")
      .then(/* Apply the successful asynchronous result to the current operation. */ (value) => {
        if (active) setCollection(value);
      })
      .catch(/* Handle the failed operation without leaving stale UI feedback. */ () => {
        if (active)
          setError("We could not load your achievements. Please try again.");
      })
      .finally(/* Release pending state after the asynchronous operation settles. */ () => {
        if (active) setPending(false);
      });
    return /* Return the derived value for the enclosing operation. */ () => {
      active = false;
    };
  }, [registered, attempt]);
  /** Reload the current server data and clear the previous request error. */
  const refresh = () => {
    setError("");
    setPending(true);
    setAttempt(/* Handle the setAttempt callback using the current operation's state. */ (n) => n + 1);
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
                      .reduce(/* Handle the reduce callback using the current operation's state. */ (sum, a) => sum + a.xp, 0)
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
              {collection.earned.map(/* Convert this item into the value or UI element expected by the collection. */ (achievement) => (
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
                /* Handle the from callback using the current operation's state. */
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
