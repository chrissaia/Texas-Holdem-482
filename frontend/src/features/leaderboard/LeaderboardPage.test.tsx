/**
 * Regression tests: leaderboard/LeaderboardPage.test.tsx.
 * Exercises observable behavior and isolates API or browser dependencies.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { LeaderboardPage } from "./LeaderboardPage";

const row = {
  id: 7,
  username: "RiverJay",
  total_xp: 150,
  rank: 1,
  avatar_url: null,
  is_current_user: true,
};
const payload = {
  count: 1,
  page: 1,
  page_size: 10,
  total_pages: 1,
  period: "all_time",
  current_user: row,
  results: [row],
};
/** Response for this module's test scenario. */
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
/** Page for this module's test scenario. */
const page = (path = "/leaderboard", key = "same") => (
  <MemoryRouter initialEntries={[path]}>
    <LeaderboardPage key={key} />
  </MemoryRouter>
);
afterEach(/* Restore test isolation after the preceding scenario. */ () => vi.unstubAllGlobals());

test("renders real XP, shared rank and current user without fake stats", /* Verify renders real XP, shared rank and current user without fake stats. */ async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload)));
  render(page());
  expect(
    await screen.findByRole("table", { name: "All-time XP rankings" }),
  ).toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getByText("RiverJay")).toBeInTheDocument();
  expect(within(table).getByText("150")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Your ranking" }),
  ).toHaveTextContent("150 XP");
  expect(screen.queryByText("Win Rate")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

test("empty leaderboard has no made-up podium", /* Verify empty leaderboard has no made-up podium. */ async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({ ...payload, count: 0, results: [], current_user: null }),
      ),
  );
  render(page());
  expect(await screen.findByText("No players yet")).toBeInTheDocument();
  expect(screen.queryByLabelText("Leading players")).not.toBeInTheDocument();
});

test("anonymous viewing omits personal ranking and supports dynamic avatars", /* Verify anonymous viewing omits personal ranking and supports dynamic avatars. */ async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({
          ...payload,
          current_user: null,
          results: [
            {
              ...row,
              avatar_url: "/media/avatars/real.webp",
              is_current_user: false,
            },
          ],
        }),
      ),
  );
  render(page());
  await screen.findByRole("table");
  expect(
    screen.queryByRole("region", { name: "Your ranking" }),
  ).not.toBeInTheDocument();
  expect(
    document.querySelector('img[src="/media/avatars/real.webp"]'),
  ).not.toBeNull();
});

test("pagination requests page 2 and preserves server ranks", /* Verify pagination requests page 2 and preserves server ranks. */ async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ ...payload, count: 11, total_pages: 2 }))
    .mockResolvedValueOnce(
      response({
        ...payload,
        page: 2,
        total_pages: 2,
        results: [{ ...row, username: "SecondPage", rank: 11 }],
      }),
    )
    .mockResolvedValueOnce(response(payload));
  vi.stubGlobal("fetch", fetch);
  render(page());
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("SecondPage")).toBeInTheDocument();
  expect(fetch.mock.calls[1][0]).toBe("/api/leaderboard/?page=2");
  expect(screen.getByRole("table")).toHaveTextContent("#11");
  expect(screen.queryByLabelText("Leading players")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByRole("table");
  expect(fetch.mock.calls[2][0]).toBe("/api/leaderboard/?page=1");
});

test("bad page errors allow page 1 recovery", /* Verify bad page errors allow page 1 recovery. */ async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({}, 404))
    .mockResolvedValueOnce(response(payload));
  vi.stubGlobal("fetch", fetch);
  render(page("/leaderboard?page=999"));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
  fireEvent.click(screen.getByRole("button", { name: "Page 1" }));
  await screen.findByRole("table");
  expect(fetch.mock.calls[1][0]).toBe("/api/leaderboard/?page=1");
});

test("failed load supports retry and manual refresh", /* Verify failed load supports retry and manual refresh. */ async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(/* Handle the mockImplementation callback using the current operation's state. */ () => Promise.resolve(response(payload)));
  vi.stubGlobal("fetch", fetch);
  render(page());
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Refresh rankings" }));
  await screen.findByRole("table");
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("late response from prior account is ignored after remount", /* Verify late response from prior account is ignored after remount. */ async () => {
  let resolve!: (value: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      /* Handle the mockImplementationOnce callback using the current operation's state. */
      () =>
        new Promise<Response>(/* Return the derived value for the enclosing operation. */ (r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce(
      response({ ...payload, results: [], current_user: null, count: 0 }),
    );
  vi.stubGlobal("fetch", fetch);
  const view = render(page());
  view.rerender(page("/leaderboard", "other"));
  await screen.findByText("No players yet");
  await act(/* Handle the act callback using the current operation's state. */ async () => resolve(response(payload)));
  expect(screen.queryByText("RiverJay")).not.toBeInTheDocument();
});

test("three podium entries use the server competition ranks", /* Verify three podium entries use the server competition ranks. */ async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({
          ...payload,
          results: [
            row,
            { ...row, id: 8, username: "Tie", is_current_user: false },
            {
              ...row,
              id: 9,
              username: "Third",
              rank: 3,
              total_xp: 50,
              is_current_user: false,
            },
          ],
        }),
      ),
  );
  render(page());
  await screen.findByRole("table");
  const podium = screen.getByLabelText("Leading players");
  expect(within(podium).getByText("#1 · LEADER")).toBeInTheDocument();
  expect(within(podium).getByText("#1 · TOP THREE")).toBeInTheDocument();
  expect(within(podium).getByText("#3 · TOP THREE")).toBeInTheDocument();
});
