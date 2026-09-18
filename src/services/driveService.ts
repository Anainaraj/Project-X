import type { AppError } from '../types/error'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

interface DriveFile {
  id: string
  name: string
}

interface DriveFileListResponse {
  files: DriveFile[]
}

function toAppError(message: string, cause?: unknown): AppError {
  return { code: 'DRIVE_ERROR', message, cause }
}

async function safeReadErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

async function driveFetch<T>(
  accessToken: string,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${DRIVE_FILES_URL}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw toAppError(
      `Google Drive request failed (${response.status}). Please try again.`,
      await safeReadErrorBody(response),
    )
  }

  return (await response.json()) as T
}

// Drive's query language treats \ and ' as special; escape both before
// interpolating user- or config-provided values into a `q` filter.
function escapeForDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Looks for a non-trashed folder with this exact name. Because this app only
 * holds the `drive.file` scope, Drive's search is already restricted to
 * files/folders this app created — there's no risk of matching an unrelated
 * folder the user made manually outside the app.
 */
export async function findFolderByName(
  accessToken: string,
  name: string,
): Promise<string | null> {
  const query = [
    `mimeType='${FOLDER_MIME_TYPE}'`,
    `name='${escapeForDriveQuery(name)}'`,
    'trashed=false',
  ].join(' and ')

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    spaces: 'drive',
    pageSize: '1',
  })

  const data = await driveFetch<DriveFileListResponse>(accessToken, `?${params.toString()}`)
  return data.files[0]?.id ?? null
}

export async function createFolder(accessToken: string, name: string): Promise<string> {
  const data = await driveFetch<DriveFile>(accessToken, '?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE }),
  })
  return data.id
}

/** Finds the app's Drive folder by name, creating it only if it doesn't exist yet. */
export async function getOrCreateAppFolder(accessToken: string, name: string): Promise<string> {
  const existingId = await findFolderByName(accessToken, name)
  if (existingId) {
    return existingId
  }
  return createFolder(accessToken, name)
}
