import { useAuth } from '../hooks/useAuth'
import { useAppFolder } from '../hooks/useAppFolder'
import { usePhotoUpload } from '../hooks/usePhotoUpload'
import { PhotoUploader } from '../components/PhotoUploader'

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const { status: folderStatus, folderId, error: folderError, retry: retryFolder } = useAppFolder()
  const { items, uploadFiles } = usePhotoUpload(folderId)

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

      {folderStatus === 'ready' && (
        <PhotoUploader
          items={items}
          onFilesSelected={(files) => void uploadFiles(files)}
        />
      )}
    </main>
  )
}
