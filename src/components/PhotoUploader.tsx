import { useId, type ChangeEvent } from 'react'
import type { UploadItem } from '../hooks/usePhotoUpload'
import { ACCEPTED_IMAGE_TYPES } from '../utils/fileValidation'

interface PhotoUploaderProps {
  items: UploadItem[]
  onFilesSelected: (files: FileList) => void
  disabled?: boolean
}

const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',')

export function PhotoUploader({ items, onFilesSelected, disabled }: PhotoUploaderProps) {
  const selectInputId = useId()
  const cameraInputId = useId()

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      onFilesSelected(event.target.files)
    }
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
  }

  return (
    <section className="photo-uploader" aria-label="Upload photos">
      <div className="photo-uploader__actions">
        <label
          className="photo-uploader__button"
          htmlFor={selectInputId}
          data-disabled={disabled || undefined}
        >
          Choose photos
        </label>
        <input
          id={selectInputId}
          className="photo-uploader__input"
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          disabled={disabled}
          onChange={handleChange}
        />

        <label
          className="photo-uploader__button"
          htmlFor={cameraInputId}
          data-disabled={disabled || undefined}
        >
          Take a photo
        </label>
        <input
          id={cameraInputId}
          className="photo-uploader__input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={handleChange}
        />
      </div>

      {items.length > 0 && (
        <ul className="photo-uploader__list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`photo-uploader__item photo-uploader__item--${item.status}`}
            >
              <span className="photo-uploader__filename">{item.fileName}</span>
              {item.status === 'uploading' && (
                <progress value={item.progress} max={100}>
                  {item.progress}%
                </progress>
              )}
              {item.status === 'success' && (
                <span className="photo-uploader__status">
                  Uploaded
                  {item.result && (
                    <span className="photo-uploader__meta">
                      {' · '}
                      {item.result.latitude !== undefined && item.result.longitude !== undefined
                        ? `${item.result.latitude.toFixed(5)}, ${item.result.longitude.toFixed(5)}`
                        : 'No GPS data'}
                    </span>
                  )}
                </span>
              )}
              {item.status === 'error' && item.error && (
                <span
                  role="alert"
                  className="photo-uploader__status photo-uploader__status--error"
                >
                  {item.error.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
