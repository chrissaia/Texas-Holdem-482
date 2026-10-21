import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestPage } from './features/auth/GuestPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { SignInPage } from './features/auth/SignInPage'
import { getCreationContext } from './features/tables/api'
import { CreateTablePage } from './features/tables/CreateTablePage'
import { LobbyPage } from './features/tables/LobbyPage'
import { TableDetailPage } from './features/tables/TableDetailPage'
import type { CreationContext } from './features/tables/types'
import './App.css'

export function AppRoutes() {
  const [context, setContext] = useState<CreationContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    setAttempt((n) => n + 1)
  }, [])
  useEffect(() => {
    let active = true
    getCreationContext()
      .then((value) => {
        if (active) setContext(value)
      })
      .catch(() => {
        if (active) {
          setContext(null)
          setError('We could not check your session. Please try again.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])
  return (
    <Routes>
      {/* Account screens use their own full-page layout from Figma, without the sidebar. */}
      <Route path="/login" element={<SignInPage onSignedIn={refresh} />} />
      <Route path="/register" element={<RegisterPage onSignedIn={refresh} />} />
      <Route path="/guest" element={<GuestPage onSignedIn={refresh} />} />
      <Route
        element={
          <AppLayout host={context?.host ?? null}>
            <Outlet />
          </AppLayout>
        }
      >
        <Route path="/lobby" element={<LobbyPage />} />
        <Route
          path="/"
          element={
            <section className="panel home-panel">
              <span className="eyebrow">WELCOME TO RIVR</span>
              <h1>Make room for your next poker night.</h1>
              <p className="muted">
                Choose your seats, set your stakes, and create a public Texas
                Hold’em table. All stakes use virtual chips.
              </p>
              <Link className="button primary" to="/tables/create">
                Create Table →
              </Link>
              <Link className="button" to="/lobby">
                Browse public tables →
              </Link>
            </section>
          }
        />
        <Route
          path="/tables/create"
          element={
            <CreateTablePage
              context={context}
              loading={loading}
              error={error}
              refresh={refresh}
            />
          }
        />
        <Route path="/tables/:id" element={<TableDetailPage />} />
        <Route
          path="*"
          element={
            <section className="panel">
              <h1>Page not found</h1>
              <Link to="/">Back to RIVR</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
