import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAppFolder } from '../hooks/useAppFolder'
import { useAppSpreadsheet } from '../hooks/useAppSpreadsheet'

export interface AppOutletContext {
  folderId: string | null
  spreadsheetId: string | null
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { status: folderStatus, folderId, error: folderError, retry: retryFolder } = useAppFolder()
  const {
    status: sheetStatus,
    spreadsheetId,
    error: sheetError,
    retry: retrySheet,
  } = useAppSpreadsheet(folderId)
  const location = useLocation()

  const isReady = folderStatus === 'ready' && sheetStatus === 'ready'

  return (
    <div className="app-layout">
      <header className="dashboard-page__header">
        <div>
          <p className="dashboard-page__eyebrow">Signed in as</p>
          <strong>{user?.name}</strong>
          <p>{user?.email}</p>
        </div>

        {isReady && (
          <nav className="app-layout__nav" aria-label="Main">
            <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined}>
              Upload
            </Link>
            <Link to="/gallery" aria-current={location.pathname === '/gallery' ? 'page' : undefined}>
              Gallery
            </Link>
          </nav>
        )}

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

      {folderStatus === 'ready' && sheetStatus === 'loading' && <p>Setting up your photo log…</p>}

      {folderStatus === 'ready' && sheetStatus === 'error' && sheetError && (
        <div role="alert" className="dashboard-page__error">
          <p>{sheetError.message}</p>
          <button type="button" onClick={retrySheet}>
            Try again
          </button>
        </div>
      )}

      {isReady && <Outlet context={{ folderId, spreadsheetId } satisfies AppOutletContext} />}
    </div>
  )
}
