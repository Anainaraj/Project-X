import { useAuth } from '../hooks/useAuth'

export function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <main className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p className="dashboard-page__eyebrow">Signed in as</p>
          <strong>{user?.name}</strong>
          <p>{user?.email}</p>
        </div>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <p>Drive folder setup comes next.</p>
    </main>
  )
}
