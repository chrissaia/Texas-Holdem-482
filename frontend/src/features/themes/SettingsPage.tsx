/**
 * Module: themes/SettingsPage.tsx.
 * Render the themes screen, including user actions, loading states and request feedback.
 */
import { useState } from "react";
import { request } from "../../api/client";
import { getProfile } from "../profile/api";
import { useProfile } from "../profile/context";
import { AccountCard } from "../profile/AccountCard";
import { useTheme } from "./useTheme";

/** Render the settings page interface and its current state. */
export function SettingsPage() {
  const { theme, setTheme, storageError } = useTheme();
  const { registered, token, loading } = useProfile();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Persist a registered account's theme choice and reflect save failures. */
  async function changeTheme(next: "dark" | "light") {
    if (next === theme) return;
    setTheme(next);
    if (!registered) return;
    setSaving(true);
    setSaveError("");
    try {
      const csrf = token || (await getProfile()).csrf_token;
      await request("/api/profile/theme/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      setSaveError(
        "Your theme changed in this browser, but the account update failed. Try another theme to retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="page-intro">
        <h1 id="settings-title">Settings</h1>
        <p>Make RIVR feel right for you.</p>
      </div>
      <div className="profile-settings-grid">
        <AccountCard />
        <section
          className="panel appearance-panel"
          aria-labelledby="appearance-title"
        >
          <h2 id="appearance-title">Appearance</h2>
          <div className="form-field">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={theme}
              disabled={saving || loading}
              onChange={/* Return the derived value for the enclosing operation. */ (event) =>
                void changeTheme(
                  event.target.value === "light" ? "light" : "dark",
                )
              }
              aria-describedby="theme-hint"
            >
              <option value="dark">Dark navy</option>
              <option value="light">Light</option>
            </select>
            <p id="theme-hint" className="field-hint">
              Your choice is remembered in this browser, including when you sign
              out.
            </p>
          </div>
          {saveError && (
            <p role="alert" className="field-error">
              {saveError}
            </p>
          )}
          <p
            role="status"
            className={storageError ? "field-error" : "field-hint"}
          >
            {storageError
              ? "Theme changed, but this browser could not save it. It may reset when you reopen RIVR."
              : ""}
          </p>
        </section>
      </div>
    </section>
  );
}
