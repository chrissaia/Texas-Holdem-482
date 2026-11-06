/**
 * Regression tests: themes/themeAchievement.test.tsx.
 * Exercises observable behavior and isolates API or browser dependencies.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProfileContext } from "../profile/context";
import { SettingsPage } from "./SettingsPage";
import { ThemeProvider } from "./ThemeProvider";

/** Setup for this module's test scenario. */
function setup(registered = true, token = "csrf-theme", loading = false) {
  render(
    <ThemeProvider>
      <ProfileContext.Provider
        value={{
          registered,
          token,
          loading,
          error: "",
          profile: null,
          refresh: /* Return the derived value for the enclosing operation. */ () => {},
          update: /* Return the derived value for the enclosing operation. */ () => {},
        }}
      >
        <SettingsPage />
      </ProfileContext.Provider>
    </ThemeProvider>,
  );
}
beforeEach(/* Handle the beforeEach callback using the current operation's state. */ () => localStorage.clear());
afterEach(/* Restore test isolation after the preceding scenario. */ () => vi.unstubAllGlobals());

test("explicit theme change persists with CSRF, without a trophy announcement", /* Verify explicit theme change persists with CSRF, without a trophy announcement. */ async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ theme: "light" })));
  vi.stubGlobal("fetch", fetch);
  setup();
  fireEvent.change(screen.getByLabelText("Theme"), {
    target: { value: "light" },
  });
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () =>
    expect(screen.getByLabelText("Theme")).not.toBeDisabled(),
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/profile/theme/",
    expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": "csrf-theme",
      },
      body: '{"theme":"light"}',
    }),
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.queryByText("Make It Yours")).not.toBeInTheDocument();
});

test("anonymous themes remain local and cannot claim an achievement", /* Verify anonymous themes remain local and cannot claim an achievement. */ () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  setup(false);
  fireEvent.change(screen.getByLabelText("Theme"), {
    target: { value: "light" },
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Theme")).toHaveValue("light");
});

test("unchanged theme does not submit an action", /* Verify unchanged theme does not submit an action. */ () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  setup();
  fireEvent.change(screen.getByLabelText("Theme"), {
    target: { value: "dark" },
  });
  expect(fetch).not.toHaveBeenCalled();
});

test("failed account update preserves the browser theme and reports failure", /* Verify failed account update preserves the browser theme and reports failure. */ async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
  );
  setup();
  fireEvent.change(screen.getByLabelText("Theme"), {
    target: { value: "light" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "account update failed",
  );
  expect(screen.getByLabelText("Theme")).toHaveValue("light");
  expect(screen.getByLabelText("Theme")).not.toBeDisabled();
});

test("fetches a CSRF token when the profile is still loading", /* Verify fetches a CSRF token when the profile is still loading. */ async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ csrf_token: "fresh-csrf" })),
    )
    .mockResolvedValueOnce(new Response('{"theme":"light"}'));
  vi.stubGlobal("fetch", fetch);
  setup(true, "");
  fireEvent.change(screen.getByLabelText("Theme"), {
    target: { value: "light" },
  });
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () => expect(fetch).toHaveBeenCalledTimes(2));
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () =>
    expect(screen.getByLabelText("Theme")).not.toBeDisabled(),
  );
  expect(fetch.mock.calls[0][0]).toBe("/api/profile/");
  expect(fetch.mock.calls[1][1].headers["X-CSRFToken"]).toBe("fresh-csrf");
});


test('waits for account identity before accepting theme changes', /* Verify waits for account identity before accepting theme changes. */ () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  setup(false, '', true)
  expect(screen.getByLabelText('Theme')).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})
