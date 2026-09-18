import { useOutletContext } from 'react-router-dom'
import { useGallery } from '../hooks/useGallery'
import { PhotoGallery } from '../components/PhotoGallery'
import type { AppOutletContext } from '../components/AppLayout'

export function GalleryPage() {
  const { spreadsheetId } = useOutletContext<AppOutletContext>()
  const { status, photos, error, refresh } = useGallery(spreadsheetId)

  return (
    <section aria-label="Photo gallery">
      <div className="gallery-page__toolbar">
        <h2>Gallery</h2>
        <button type="button" onClick={refresh} disabled={status === 'loading'}>
          {status === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {status === 'loading' && photos.length === 0 && <p>Loading your photos…</p>}

      {status === 'error' && error && (
        <div role="alert" className="dashboard-page__error">
          <p>{error.message}</p>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && photos.length === 0 && <p>No photos yet. Upload one to see it here.</p>}

      {photos.length > 0 && <PhotoGallery photos={photos} />}
    </section>
  )
}
