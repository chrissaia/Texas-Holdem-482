import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { AchievementsPage } from "./AchievementsPage";
import { ProfileContext } from "../profile/context";

const earned = {
  code: "picture",
  name: "Picture Perfect",
  description: "Save your first profile picture.",
  xp: 50,
  earned_at: "2026-11-03T00:00:00Z",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function page(registered = true, loading = false, key = "one") {
  return (
    <MemoryRouter>
      <ProfileContext.Provider
        value={{
          registered,
          loading,
          error: "",
          profile: null,
          token: "",
          refresh: () => {},
          update: () => {},
        }}
      >
        <AchievementsPage key={key} />
      </ProfileContext.Provider>
    </MemoryRouter>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows only earned details, hidden trophy slots and real XP", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      respond({ total_xp: 250, total_achievements: 24, earned: [earned] }),
    );
  vi.stubGlobal("fetch", fetch);
  render(page());
  expect(await screen.findByText("Picture Perfect")).toBeInTheDocument();
  expect(screen.getAllByText("Hidden achievement")).toHaveLength(23);
  expect(screen.queryByText("House Rules")).not.toBeInTheDocument();
  expect(screen.getByText("250")).toBeInTheDocument();
  expect(screen.getByText("1 / 24")).toBeInTheDocument();
  expect(screen.getByText(/Split pots do not count/)).toBeInTheDocument();
  expect(document.querySelectorAll(".achievement-emblem img")).toHaveLength(24);
  expect(fetch).toHaveBeenCalledWith(
    "/api/achievements/",
    expect.objectContaining({ credentials: "same-origin" }),
  );
});

test("empty collection reveals no requirements", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        respond({ total_xp: 0, total_achievements: 24, earned: [] }),
      ),
  );
  render(page());
  expect(await screen.findAllByText("Hidden achievement")).toHaveLength(24);
  expect(
    screen.queryByText("Save your first profile picture."),
  ).not.toBeInTheDocument();
});

test("anonymous users receive sign in link without fetching", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(page(false));
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(fetch).not.toHaveBeenCalled();
});

test("identity loading displays a status", () => {
  vi.stubGlobal("fetch", vi.fn());
  render(page(false, true));
  expect(screen.getByRole("status")).toHaveTextContent("Checking your account");
});

test("failed fetch supports retry and manual refresh without awarding XP", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(respond({}, 503))
    .mockImplementation(() =>
      Promise.resolve(
        respond({ total_xp: 50, total_achievements: 24, earned: [earned] }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  render(page());
  expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Picture Perfect")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh collection" }));
  expect(await screen.findByText("Picture Perfect")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(3);
  for (const [, options] of fetch.mock.calls)
    expect(options.method).toBeUndefined();
});

test("late response from a previous account cannot reveal their collection", async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(
      respond({ total_xp: 0, total_achievements: 24, earned: [] }),
    );
  vi.stubGlobal("fetch", fetch);
  const view = render(page());
  view.rerender(page(true, false, "two"));
  await screen.findAllByText("Hidden achievement");
  await act(async () => {
    resolve(
      respond({ total_xp: 50, total_achievements: 24, earned: [earned] }),
    );
  });
  expect(screen.queryByText("Picture Perfect")).not.toBeInTheDocument();
});

test("reveals repeat XP only for an earned repeatable trophy", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      respond({
        total_xp: 400,
        total_achievements: 24,
        earned: [
          {
            ...earned,
            code: "seven_two",
            name: "Against the Odds",
            repeat_xp: 50,
          },
        ],
      }),
    ),
  );
  render(page());
  expect(await screen.findByText("Against the Odds")).toBeInTheDocument();
  expect(screen.getByText(/50 XP on repeat wins/)).toBeInTheDocument();
  expect(screen.getByText("400")).toBeInTheDocument();
  expect(screen.getAllByText("Hidden achievement")).toHaveLength(23);
});
