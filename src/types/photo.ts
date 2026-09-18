/** A photo that has been uploaded to the user's Drive folder. */
export interface PhotoRecord {
  fileId: string
  name: string
  webViewLink?: string
  uploadedAt: string
  /** Filled in by EXIF extraction (Phase 7) when the image has GPS data. */
  latitude?: number
  longitude?: number
  /** Original capture time from EXIF, distinct from `uploadedAt`. */
  captureTimestamp?: string
}
