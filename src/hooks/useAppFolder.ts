import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrCreateAppFolder } from '../services/driveService'
import { useAuth } from './useAuth'
import { DRIVE_FOLDER_NAME } from '../config/appConfig'
import type { AppError } from '../types/error'

type FolderStatus = 'idle' | 'loading' | 'ready' | 'error'

interface UseAppFolderResult {
  status: FolderStatus
  folderId: string | null
  error: AppError | null
  retry: () => void
}

/** Ensures the signed-in user's app folder exists, creating it on first use. */
export function useAppFolder(): UseAppFolderResult {
  const { status: authStatus, getAccessToken } = useAuth()
  const [status, setStatus] = useState<FolderStatus>('idle')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  // Guards against concurrent calls (e.g. React StrictMode's dev-only double
  // effect invocation), which would otherwise race two find-or-create calls
  // against each other and create two folders before either finishes.
  const inFlightRef = useRef(false)

  const ensureFolder = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setStatus('loading')
    setError(null)
    try {
      const accessToken = await getAccessToken()
      const id = await getOrCreateAppFolder(accessToken, DRIVE_FOLDER_NAME)
      setFolderId(id)
      setStatus('ready')
    } catch (err) {
      setError(err as AppError)
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [getAccessToken])

  useEffect(() => {
    if (authStatus === 'authenticated' && status === 'idle') {
      void ensureFolder()
    }
  }, [authStatus, status, ensureFolder])

  const retry = useCallback(() => {
    void ensureFolder()
  }, [ensureFolder])

  return { status, folderId, error, retry }
}
