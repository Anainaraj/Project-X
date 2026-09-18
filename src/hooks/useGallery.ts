import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { listLoggedPhotos } from '../services/sheetsService'
import type { PhotoRecord } from '../types/photo'
import type { AppError } from '../types/error'

type GalleryStatus = 'idle' | 'loading' | 'ready' | 'error'

interface UseGalleryResult {
  status: GalleryStatus
  photos: PhotoRecord[]
  error: AppError | null
  refresh: () => void
}

/** Loads every logged photo from the sheet — refresh() re-reads it on demand. */
export function useGallery(spreadsheetId: string | null): UseGalleryResult {
  const { getAccessToken } = useAuth()
  const [status, setStatus] = useState<GalleryStatus>('idle')
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const inFlightRef = useRef(false)

  const load = useCallback(async () => {
    if (!spreadsheetId || inFlightRef.current) return
    inFlightRef.current = true
    setStatus('loading')
    setError(null)
    try {
      const accessToken = await getAccessToken()
      const records = await listLoggedPhotos(accessToken, spreadsheetId)
      setPhotos(records)
      setStatus('ready')
    } catch (err) {
      setError(err as AppError)
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [spreadsheetId, getAccessToken])

  useEffect(() => {
    if (spreadsheetId && status === 'idle') {
      void load()
    }
  }, [spreadsheetId, status, load])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  return { status, photos, error, refresh }
}
