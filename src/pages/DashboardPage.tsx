import { useOutletContext } from 'react-router-dom'
import { usePhotoUpload } from '../hooks/usePhotoUpload'
import { PhotoUploader } from '../components/PhotoUploader'
import type { AppOutletContext } from '../components/AppLayout'

export function DashboardPage() {
  const { folderId, spreadsheetId } = useOutletContext<AppOutletContext>()
  const { items, uploadFiles } = usePhotoUpload(folderId, spreadsheetId)

  return (
    <section aria-label="Upload photos">
      <h2>Upload</h2>
      <PhotoUploader items={items} onFilesSelected={(files) => void uploadFiles(files)} />
    </section>
  )
}
