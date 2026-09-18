import { PhotoThumbnail } from './PhotoThumbnail'
import type { PhotoRecord } from '../types/photo'

interface PhotoGalleryProps {
  photos: PhotoRecord[]
}

function formatCaptureTimestamp(iso: string | undefined): string {
  if (!iso) return 'Capture time unknown'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Capture time unknown' : date.toLocaleString()
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  return (
    <ul className="photo-gallery">
      {photos.map((photo) => (
        <li key={photo.fileId} className="photo-gallery__item">
          <PhotoThumbnail fileId={photo.fileId} alt={photo.name} />
          <div className="photo-gallery__meta">
            <p className="photo-gallery__name">{photo.name}</p>
            <p className="photo-gallery__coords">
              {photo.latitude !== undefined && photo.longitude !== undefined
                ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`
                : 'No GPS data'}
            </p>
            <p className="photo-gallery__timestamp">{formatCaptureTimestamp(photo.captureTimestamp)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
