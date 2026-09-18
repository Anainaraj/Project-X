import { env } from '../config/env'
import type {
  GisTokenClient,
  GisTokenClientError,
  GisTokenResponse,
} from '../types/google-identity'
import type { AuthUser } from '../types/auth'
import type { AppError } from '../types/error'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const OAUTH_SCOPES = `openid email profile ${DRIVE_FILE_SCOPE}`

export interface AcquiredToken {
  accessToken: string
  expiresAt: number
  scope: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
}

function toAppError(code: AppError['code'], message: string, cause?: unknown): AppError {
  return { code, message, cause }
}

function mapGisError(error: string | undefined): AppError {
  switch (error) {
    case 'access_denied':
      return toAppError(
        'AUTH_ACCESS_DENIED',
        'You denied the requested Google permissions. This app needs Drive access to create and manage your photo folder, so sign-in cannot continue without it.',
      )
    case 'popup_closed_by_user':
    case 'popup_failed_to_open':
      return toAppError(
        'AUTH_POPUP_CLOSED',
        'The Google sign-in window was closed before finishing. Please try again.',
      )
    default:
      return toAppError('AUTH_FAILED', 'Google sign-in failed. Please try again.', error)
  }
}

// Fires for failures that happen before Google's own token callback would run,
// e.g. the browser blocking the sign-in popup outright.
function mapGisClientError(error: GisTokenClientError): AppError {
  switch (error.type) {
    case 'popup_failed_to_open':
      return toAppError(
        'AUTH_POPUP_CLOSED',
        'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.',
        error,
      )
    case 'popup_closed':
      return toAppError(
        'AUTH_POPUP_CLOSED',
        'The Google sign-in window was closed before finishing. Please try again.',
        error,
      )
    default:
      return toAppError('AUTH_FAILED', 'Google sign-in failed. Please try again.', error)
  }
}

let gisScriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise

  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(
        toAppError(
          'AUTH_FAILED',
          'Could not load Google Identity Services. Check your connection and try again.',
        ),
      )
    document.head.appendChild(script)
  })

  return gisScriptPromise
}

let tokenClient: GisTokenClient | null = null
let pendingResolve: ((response: GisTokenResponse) => void) | null = null
let pendingReject: ((error: AppError) => void) | null = null

function handleTokenResponse(response: GisTokenResponse): void {
  if (response.error) {
    pendingReject?.(mapGisError(response.error))
  } else {
    pendingResolve?.(response)
  }
  pendingResolve = null
  pendingReject = null
}

function handleTokenClientError(error: GisTokenClientError): void {
  pendingReject?.(mapGisClientError(error))
  pendingResolve = null
  pendingReject = null
}

function getTokenClient(): GisTokenClient {
  if (!tokenClient) {
    if (!window.google?.accounts?.oauth2) {
      throw toAppError('AUTH_FAILED', 'Google Identity Services is not loaded yet.')
    }
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: env.googleClientId,
      scope: OAUTH_SCOPES,
      callback: handleTokenResponse,
      error_callback: handleTokenClientError,
    })
  }
  return tokenClient
}

/**
 * Requests an OAuth access token. `interactive: false` attempts a silent
 * refresh (no popup) for renewing an expiring token; it rejects if Google
 * cannot do this without user interaction, which callers treat as
 * "session expired, please sign in again".
 */
export async function requestAccessToken(
  options: { interactive?: boolean } = {},
): Promise<AcquiredToken> {
  await loadGisScript()
  const client = getTokenClient()

  return new Promise<AcquiredToken>((resolve, reject) => {
    pendingResolve = (response) => {
      resolve({
        accessToken: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
        scope: response.scope,
      })
    }
    pendingReject = reject
    client.requestAccessToken(options.interactive === false ? { prompt: '' } : undefined)
  })
}

export async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw toAppError('AUTH_FAILED', 'Could not retrieve your Google profile.')
  }
  const data = (await response.json()) as GoogleUserInfo
  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}

export function revokeAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}
