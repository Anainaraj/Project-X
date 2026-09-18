import type { AppError } from '../types/error'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

interface DriveFile {
  id: string
  name: string
}

export interface UploadedDriveFile {
  id: string
  name: string
  webViewLink?: string
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

/** Lists the names of all non-trashed files directly inside a folder. */
export async function listFileNamesInFolder(
  accessToken: string,
  folderId: string,
): Promise<Set<string>> {
  const query = [`'${escapeForDriveQuery(folderId)}' in parents`, 'trashed=false'].join(' and ')

  const params = new URLSearchParams({
    q: query,
    fields: 'files(name)',
    spaces: 'drive',
    pageSize: '1000',
  })

  const data = await driveFetch<{ files: { name: string }[] }>(
    accessToken,
    `?${params.toString()}`,
  )
  return new Set(data.files.map((file) => file.name))
}

function splitFileName(name: string): { base: string; ext: string } {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) {
    return { base: name, ext: '' }
  }
  return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) }
}

/**
 * Drive allows multiple files with the same name, but that's confusing for
 * users browsing their folder. Appends " (1)", " (2)", ... until the name is
 * free among `existingNames`.
 */
export function resolveUniqueFileName(desiredName: string, existingNames: Set<string>): string {
  if (!existingNames.has(desiredName)) {
    return desiredName
  }

  const { base, ext } = splitFileName(desiredName)
  let counter = 1
  let candidate = `${base} (${counter})${ext}`
  while (existingNames.has(candidate)) {
    counter += 1
    candidate = `${base} (${counter})${ext}`
  }
  return candidate
}

/**
 * Uploads a file into a folder using Drive's resumable upload protocol.
 * Google recommends resumable uploads over simple/multipart for anything
 * over 5 MB (routine for phone photos), and it's the only way to get real
 * upload-progress events via XMLHttpRequest's `upload.onprogress`.
 *
 * The PUT to the returned session URI intentionally omits the Authorization
 * header — per Google's own sample code, the session URI itself carries the
 * authorization context.
 */
export function uploadPhotoToFolder(
  accessToken: string,
  folderId: string,
  file: File,
  fileName: string,
  onProgress?: (percent: number) => void,
): Promise<UploadedDriveFile> {
  return new Promise((resolve, reject) => {
    const initXhr = new XMLHttpRequest()
    initXhr.open(
      'POST',
      `${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id,name,webViewLink`,
    )
    initXhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    initXhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8')
    initXhr.setRequestHeader('X-Upload-Content-Type', file.type)
    initXhr.setRequestHeader('X-Upload-Content-Length', String(file.size))

    initXhr.onerror = () =>
      reject(toAppError(`Network error starting the upload for "${fileName}".`))

    initXhr.onload = () => {
      if (initXhr.status < 200 || initXhr.status >= 300) {
        reject(
          toAppError(
            `Could not start the upload for "${fileName}" (${initXhr.status}).`,
            initXhr.responseText,
          ),
        )
        return
      }

      const sessionUrl = initXhr.getResponseHeader('Location')
      if (!sessionUrl) {
        reject(toAppError(`Upload session for "${fileName}" did not return a session URL.`))
        return
      }

      const putXhr = new XMLHttpRequest()
      putXhr.open('PUT', sessionUrl)
      putXhr.setRequestHeader('Content-Type', file.type)

      putXhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }

      putXhr.onerror = () => reject(toAppError(`Network error while uploading "${fileName}".`))

      putXhr.onload = () => {
        if (putXhr.status < 200 || putXhr.status >= 300) {
          reject(
            toAppError(`Upload failed for "${fileName}" (${putXhr.status}).`, putXhr.responseText),
          )
          return
        }
        try {
          resolve(JSON.parse(putXhr.responseText) as UploadedDriveFile)
        } catch (err) {
          reject(toAppError(`Could not read the upload response for "${fileName}".`, err))
        }
      }

      putXhr.send(file)
    }

    initXhr.send(JSON.stringify({ name: fileName, parents: [folderId] }))
  })
}
