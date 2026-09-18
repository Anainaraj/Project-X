import { useAuth } from '../hooks/useAuth'
import { useAppFolder } from '../hooks/useAppFolder'

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const { status: folderStatus, error: folderError, retry: retryFolder } = useAppFolder()

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

      {folderStatus === 'loading' && <p>Setting up your Drive folder…</p>}

      {folderStatus === 'error' && folderError && (
        <div role="alert" className="dashboard-page__error">
          <p>{folderError.message}</p>
          <button type="button" onClick={retryFolder}>
            Try again
          </button>
        </div>
      )}

      {folderStatus === 'ready' && <p>Drive folder ready. Upload comes next.</p>}
    </main>
  )
}
