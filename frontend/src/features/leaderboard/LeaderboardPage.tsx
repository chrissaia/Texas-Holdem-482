import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { request } from "../../api/client";
import fallback48 from "../../assets/figma/leaderboard-avatar-48.svg";
import fallback64 from "../../assets/figma/leaderboard-avatar-64.svg";
import "./leaderboard.css";

type Player = {
  id: number;
  username: string;
  avatar_url: string | null;
  total_xp: number;
  rank: number;
  is_current_user: boolean;
};
type Rankings = {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  period: "all_time";
  current_user: Player | null;
  results: Player[];
};

function PlayerIdentity({
  player,
  podium = 0,
}: {
  player: Player;
  podium?: number;
}) {
  return (
    <span className="ranked-player">
      {player.avatar_url ? (
        <img src={player.avatar_url} alt="" />
      ) : (
        <span
          className={`ranked-initials ${podium === 1 ? "avatar-64" : ""}`}
          aria-hidden="true"
        >
          {podium > 0 && (
            <img
              className="podium-fallback"
              src={podium === 1 ? fallback64 : fallback48}
              alt=""
            />
          )}
          <span>{player.username.slice(0, 2).toUpperCase()}</span>
        </span>
      )}
      <span>
        {player.username}
        {player.is_current_user && <span className="ranked-you"> · You</span>}
      </span>
    </span>
  );
}

export function LeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const page = params.get("page") || "1";
  const [result, setResult] = useState<{
    key: string;
    data: Rankings | null;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${page}:${attempt}`;
  const current = result?.key === key ? result : null;
  useEffect(() => {
    let active = true;
    request<Rankings>(`/api/leaderboard/?${new URLSearchParams({ page })}`)
      .then((data) => {
        if (active) setResult({ key, data, error: "" });
      })
      .catch(() => {
        if (active)
          setResult({
            key,
            data: null,
            error:
              "We could not load these rankings. Try again or return to page 1.",
          });
      });
    return () => {
      active = false;
    };
  }, [page, key]);
  const data = current?.data;
  return (
    <section className="leaderboard-page">
      <div className="page-intro">
        <span className="eyebrow">GLOBAL · ALL-TIME XP</span>
        <h1>Every hand moves you forward.</h1>
        <p className="muted">
          Rankings by earned XP. Compete for recognition, not real money.
        </p>
      </div>
      <div className="leaderboard-controls">
        <span className="leaderboard-period">Global · All time</span>
        <button
          type="button"
          className="text-button"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Refresh rankings
        </button>
      </div>
      {!current ? (
        <p role="status">Loading rankings…</p>
      ) : current.error ? (
        <div role="alert" className="notice error-notice">
          {current.error}
          <button
            className="text-button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (page === "1") setAttempt((n) => n + 1);
              else setParams({});
            }}
          >
            Page 1
          </button>
        </div>
      ) : (
        data && (
          <>
            {data.results.length === 0 ? (
              <section className="panel">
                <h2>No players yet</h2>
                <p className="muted">
                  Registered players will appear here as the community grows.
                </p>
              </section>
            ) : (
              <>
                {data.page === 1 && (
                  <div
                    className="leaderboard-podium"
                    aria-label="Leading players"
                  >
                    {data.results.slice(0, 3).map((player, index) => (
                      <article
                        key={player.id}
                        className={`panel podium-card podium-${index + 1}`}
                      >
                        <span className="leaderboard-period">
                          #{player.rank}
                          {index === 0 ? " · LEADER" : " · TOP THREE"}
                        </span>
                        <PlayerIdentity player={player} podium={index + 1} />
                        <p className="podium-xp">
                          {player.total_xp.toLocaleString("en-US")} XP
                        </p>
                      </article>
                    ))}
                  </div>
                )}
                <section className="panel rankings-panel">
                  <div className="collection-heading">
                    <h2>Global rankings</h2>
                    <span className="muted">
                      {data.count} registered players
                    </span>
                  </div>
                  <table className="rankings-table">
                    <caption className="sr-only">All-time XP rankings</caption>
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Player</th>
                        <th scope="col">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((player) => (
                        <tr
                          key={player.id}
                          className={
                            player.is_current_user ? "current-player" : ""
                          }
                        >
                          <td>#{player.rank}</td>
                          <th scope="row">
                            <PlayerIdentity player={player} />
                          </th>
                          <td>{player.total_xp.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <nav
                    className="rankings-pagination"
                    aria-label="Leaderboard pages"
                  >
                    <button
                      className="button"
                      disabled={data.page <= 1}
                      onClick={() => setParams({ page: String(data.page - 1) })}
                    >
                      Previous
                    </button>
                    <span>
                      Page {data.page} of {data.total_pages}
                    </span>
                    <button
                      className="button"
                      disabled={data.page >= data.total_pages}
                      onClick={() => setParams({ page: String(data.page + 1) })}
                    >
                      Next
                    </button>
                  </nav>
                </section>
              </>
            )}
            {data.current_user && (
              <section className="panel your-ranking" aria-label="Your ranking">
                <h2>Your ranking</h2>
                <PlayerIdentity player={data.current_user} />
                <p>
                  <strong>#{data.current_user.rank}</strong> ·{" "}
                  {data.current_user.total_xp.toLocaleString("en-US")} XP
                </p>
              </section>
            )}
            <p className="notice">
              Equal XP shares the same rank. Rankings update when you refresh.
              Friends, weekly and seasonal rankings are outside this view.
            </p>
          </>
        )
      )}
    </section>
  );
}
