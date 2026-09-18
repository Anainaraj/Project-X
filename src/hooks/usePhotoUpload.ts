import { useCallback, useState } from 'react'
import { useAuth } from './useAuth'
import {
  listFileNamesInFolder,
  resolveUniqueFileName,
  uploadPhotoToFolder,
} from '../services/driveService'
import { extractExifData } from '../services/exifService'
import { validateImageFile } from '../utils/fileValidation'
import type { AppError } from '../types/error'
import type { PhotoRecord } from '../types/photo'

export type UploadItemStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface UploadItem {
  id: string
  fileName: string
  status: UploadItemStatus
  progress: number
  error?: AppError
  result?: PhotoRecord
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function usePhotoUpload(folderId: string | null) {
  const { getAccessToken } = useAuth()
  const [items, setItems] = useState<UploadItem[]>([])

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!folderId) return
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      const staged = fileArray.map((file) => ({
        id: createId(),
        file,
        validation: validateImageFile(file),
      }))

      setItems((prev) => [
        ...staged.map(
          ({ id, file, validation }): UploadItem => ({
            id,
            fileName: file.name,
            status: validation.valid ? 'pending' : 'error',
            progress: 0,
            error: validation.valid
              ? undefined
              : { code: 'UPLOAD_INVALID_FILE', message: validation.reason! },
          }),
        ),
        ...prev,
      ])

      const uploadable = staged.filter((entry) => entry.validation.valid)
      if (uploadable.length === 0) return

      let accessToken: string
      let existingNames: Set<string>
      try {
        accessToken = await getAccessToken()
        existingNames = await listFileNamesInFolder(accessToken, folderId)
      } catch (err) {
        for (const { id } of uploadable) {
          updateItem(id, { status: 'error', error: err as AppError })
        }
        return
      }

      // Sequential on purpose: each upload's chosen name must be reserved
      // before the next one checks for collisions against the same batch.
      for (const { id, file } of uploadable) {
        const uniqueName = resolveUniqueFileName(file.name, existingNames)
        existingNames.add(uniqueName)
        updateItem(id, { status: 'uploading', fileName: uniqueName })

        try {
          // Independent local/network operations on the same File — run together.
          const [exifData, driveFile] = await Promise.all([
            extractExifData(file),
            uploadPhotoToFolder(accessToken, folderId, file, uniqueName, (progress) =>
              updateItem(id, { progress }),
            ),
          ])

          const result: PhotoRecord = {
            fileId: driveFile.id,
            name: driveFile.name,
            webViewLink: driveFile.webViewLink,
            uploadedAt: new Date().toISOString(),
            latitude: exifData.gps?.latitude,
            longitude: exifData.gps?.longitude,
            captureTimestamp: exifData.captureTimestamp?.toISOString(),
          }

          updateItem(id, { status: 'success', progress: 100, result })
        } catch (err) {
          updateItem(id, { status: 'error', error: err as AppError })
        }
      }
    },
    [folderId, getAccessToken, updateItem],
  )

  return { items, uploadFiles }
}
