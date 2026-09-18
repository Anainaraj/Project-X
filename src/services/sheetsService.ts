import type { AppError } from '../types/error'

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const NOT_AVAILABLE = 'Not available'

// Ranges intentionally omit a sheet name (e.g. "A1:G1", not "Sheet1!A1:G1").
// Per Google's docs, an unqualified range targets "the first visible sheet"
// regardless of its actual title — which can be locale-dependent (a fresh
// spreadsheet's first tab may not literally be named "Sheet1" for every
// Google Account locale). This avoids hardcoding a name that isn't
// guaranteed to match.
const HEADER_RANGE = 'A1:G1'
const DATA_COLUMN_RANGE = 'A:G'
const LOGGED_IDS_RANGE = 'A2:A'

const HEADER_ROW = [
  'File ID',
  'Photo Name',
  'Drive Link',
  'Latitude',
  'Longitude',
  'Capture Timestamp',
  'Upload Timestamp',
]

export interface PhotoLogEntry {
  fileId: string
  name: string
  webViewLink?: string
  latitude?: number
  longitude?: number
  captureTimestamp?: string
  uploadedAt: string
}

function toAppError(message: string, cause?: unknown): AppError {
  return { code: 'SHEETS_ERROR', message, cause }
}

async function safeReadErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

async function sheetsFetch<T>(
  accessToken: string,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${SHEETS_BASE_URL}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw toAppError(
      `Google Sheets request failed (${response.status}). Please try again.`,
      await safeReadErrorBody(response),
    )
  }

  return (await response.json()) as T
}

/** Writes the column header row, but only if row 1 is currently empty. */
export async function ensureHeaderRow(accessToken: string, spreadsheetId: string): Promise<void> {
  const existing = await sheetsFetch<{ values?: string[][] }>(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(HEADER_RANGE)}`,
  )

  if (existing.values && existing.values.length > 0) {
    return
  }

  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(HEADER_RANGE)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: HEADER_RANGE, values: [HEADER_ROW] }),
    },
  )
}

/** Drive file IDs already logged (column A, header row excluded). */
async function getLoggedFileIds(accessToken: string, spreadsheetId: string): Promise<Set<string>> {
  const data = await sheetsFetch<{ values?: string[][] }>(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(LOGGED_IDS_RANGE)}`,
  )
  const ids = (data.values ?? []).map((row) => row[0]).filter((id): id is string => Boolean(id))
  return new Set(ids)
}

function formatCoordinate(value: number | undefined): string {
  return value === undefined ? NOT_AVAILABLE : value.toFixed(6)
}

/**
 * Appends one log row for a photo, unless its fileId is already present —
 * so re-logging the same successful upload (e.g. a retry) doesn't create a
 * duplicate row.
 *
 * This check-then-append is not atomic: it can't fully protect against two
 * near-simultaneous log attempts for the same photo (e.g. two browser tabs)
 * racing past the read before either has appended. That's an accepted
 * limitation of doing this without a backend — a real multi-writer system
 * would need a server-side unique constraint, which Sheets doesn't offer.
 */
export async function logPhoto(
  accessToken: string,
  spreadsheetId: string,
  entry: PhotoLogEntry,
): Promise<void> {
  const alreadyLogged = await getLoggedFileIds(accessToken, spreadsheetId)
  if (alreadyLogged.has(entry.fileId)) {
    return
  }

  const row = [
    entry.fileId,
    entry.name,
    entry.webViewLink ?? NOT_AVAILABLE,
    formatCoordinate(entry.latitude),
    formatCoordinate(entry.longitude),
    entry.captureTimestamp ?? NOT_AVAILABLE,
    entry.uploadedAt,
  ]

  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(DATA_COLUMN_RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [row] }),
    },
  )
}
