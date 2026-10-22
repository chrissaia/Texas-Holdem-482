import { useTheme } from './useTheme'

export function SettingsPage() {
  const { theme, setTheme, storageError } = useTheme()
  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="page-intro">
        <h1 id="settings-title">Settings</h1>
        <p>Make RIVR feel right for you.</p>
      </div>
      <section className="panel appearance-panel" aria-labelledby="appearance-title">
        <h2 id="appearance-title">Appearance</h2>
        <div className="form-field">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value === 'light' ? 'light' : 'dark')}
            aria-describedby="theme-hint"
          >
            <option value="dark">Dark navy</option>
            <option value="light">Light</option>
          </select>
          <p id="theme-hint" className="field-hint">
            Your choice is remembered in this browser, including when you sign out.
          </p>
        </div>
        <p role="status" className={storageError ? 'field-error' : 'field-hint'}>
          {storageError
            ? 'Theme changed, but this browser could not save it. It may reset when you reopen RIVR.'
            : ''}
        </p>
      </section>
    </section>
  )
}
