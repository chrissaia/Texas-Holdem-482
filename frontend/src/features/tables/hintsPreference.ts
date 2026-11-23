export const HINTS_STORAGE_KEY = 'rivr-gameplay-hints'

export function readHintsPreference() {
  try {
    return localStorage.getItem(HINTS_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveHintsPreference(enabled: boolean) {
  try {
    localStorage.setItem(HINTS_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // The control still works for this visit when browser storage is unavailable.
  }
}
