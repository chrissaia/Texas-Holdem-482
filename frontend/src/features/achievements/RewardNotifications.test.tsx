import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { RewardNotifications } from "./RewardNotifications";

const baseline = { total_xp: 50, earned: [{ code: "welcome", name: "Welcome" }] };
const reward = { total_xp: 200, earned: [...baseline.earned, { code: "first_win", name: "First Pot" }] };
const response = (body: unknown) => new Response(JSON.stringify(body));
afterEach(() => vi.unstubAllGlobals());
const mount = () => render(<MemoryRouter><RewardNotifications /></MemoryRouter>);

test("old rewards stay quiet; new XP and trophies stack once and can be dismissed", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(baseline)).mockImplementation(() => Promise.resolve(response(reward)));
  vi.stubGlobal("fetch", fetch);
  mount();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.queryByText(/XP earned/)).not.toBeInTheDocument();
  fireEvent.focus(window);
  expect(await screen.findByText("+150 XP earned!")).toBeInTheDocument();
  expect(screen.getByText("Trophy unlocked: First Pot")).toBeInTheDocument();
  expect(screen.queryByText("Trophy unlocked: Welcome")).not.toBeInTheDocument();
  fireEvent.focus(window);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(screen.getAllByText("+150 XP earned!")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss reward notification" }));
  expect(screen.queryByText(/XP earned/)).not.toBeInTheDocument();
});

test("failed checks retain the baseline and repeat XP does not repeat a trophy", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(baseline)).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response({ ...baseline, total_xp: 150 }));
  vi.stubGlobal("fetch", fetch);
  mount();
  await act(async () => {});
  fireEvent.focus(window);
  await act(async () => {});
  fireEvent.focus(window);
  expect(await screen.findByText("+100 XP earned!")).toBeInTheDocument();
  expect(screen.queryByText(/Trophy unlocked/)).not.toBeInTheDocument();
});

test("unmount ignores late responses and clears polling", async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((r) => { resolve = r; })));
  const clear = vi.spyOn(window, "clearInterval");
  const view = mount();
  view.unmount();
  await act(async () => resolve(response(reward)));
  expect(clear).toHaveBeenCalled();
  clear.mockRestore();
  expect(screen.queryByText(/XP earned/)).not.toBeInTheDocument();
});
