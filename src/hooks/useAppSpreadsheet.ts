import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrCreateAppSpreadsheet } from '../services/driveService'
import { ensureHeaderRow } from '../services/sheetsService'
import { useAuth } from './useAuth'
import { SHEET_NAME } from '../config/appConfig'
import type { AppError } from '../types/error'

type SheetStatus = 'idle' | 'loading' | 'ready' | 'error'

interface UseAppSpreadsheetResult {
  status: SheetStatus
  spreadsheetId: string | null
  error: AppError | null
  retry: () => void
}

/** Ensures the log spreadsheet exists inside the given folder, with its header row set. */
export function useAppSpreadsheet(folderId: string | null): UseAppSpreadsheetResult {
  const { getAccessToken } = useAuth()
  const [status, setStatus] = useState<SheetStatus>('idle')
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const inFlightRef = useRef(false)

  const ensureSpreadsheet = useCallback(async () => {
    if (!folderId || inFlightRef.current) return
    inFlightRef.current = true
    setStatus('loading')
    setError(null)
    try {
      const accessToken = await getAccessToken()
      const id = await getOrCreateAppSpreadsheet(accessToken, folderId, SHEET_NAME)
      await ensureHeaderRow(accessToken, id)
      setSpreadsheetId(id)
      setStatus('ready')
    } catch (err) {
      setError(err as AppError)
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [folderId, getAccessToken])

  useEffect(() => {
    if (folderId && status === 'idle') {
      void ensureSpreadsheet()
    }
  }, [folderId, status, ensureSpreadsheet])

  const retry = useCallback(() => {
    void ensureSpreadsheet()
  }, [ensureSpreadsheet])

  return { status, spreadsheetId, error, retry }
}
