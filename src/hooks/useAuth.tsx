import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DRIVE_FILE_SCOPE,
  fetchUserInfo,
  requestAccessToken,
  revokeAccessToken,
} from '../services/authService'
import type { AuthUser } from '../types/auth'
import type { AppError } from '../types/error'

type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error'

interface TokenState {
  accessToken: string
  expiresAt: number
  scope: string
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: AppError | null
  hasDriveAccess: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** Returns a valid access token, silently refreshing it if it's near expiry. */
  getAccessToken: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Refresh proactively once less than a minute of validity remains.
const EXPIRY_BUFFER_MS = 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [token, setToken] = useState<TokenState | null>(null)

  const signIn = useCallback(async () => {
    setStatus('authenticating')
    setError(null)
    try {
      const acquired = await requestAccessToken({ interactive: true })

      if (!acquired.scope.includes(DRIVE_FILE_SCOPE)) {
        await revokeAccessToken(acquired.accessToken)
        setError({
          code: 'AUTH_ACCESS_DENIED',
          message:
            'Sign-in succeeded but Drive access was not granted. This app cannot work without permission to create your photo folder in Drive.',
        })
        setStatus('error')
        return
      }

      const profile = await fetchUserInfo(acquired.accessToken)
      setToken({
        accessToken: acquired.accessToken,
        expiresAt: acquired.expiresAt,
        scope: acquired.scope,
      })
      setUser(profile)
      setStatus('authenticated')
    } catch (err) {
      setError(err as AppError)
      setStatus('error')
    }
  }, [])

  const signOut = useCallback(async () => {
    if (token) {
      await revokeAccessToken(token.accessToken)
    }
    setToken(null)
    setUser(null)
    setError(null)
    setStatus('idle')
  }, [token])

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (token && token.expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
      return token.accessToken
    }
    try {
      const acquired = await requestAccessToken({ interactive: false })
      setToken({
        accessToken: acquired.accessToken,
        expiresAt: acquired.expiresAt,
        scope: acquired.scope,
      })
      return acquired.accessToken
    } catch {
      const sessionExpired: AppError = {
        code: 'AUTH_SESSION_EXPIRED',
        message: 'Your session expired. Please sign in again.',
      }
      setError(sessionExpired)
      setStatus('error')
      setToken(null)
      setUser(null)
      throw sessionExpired
    }
  }, [token])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      hasDriveAccess: token?.scope.includes(DRIVE_FILE_SCOPE) ?? false,
      signIn,
      signOut,
      getAccessToken,
    }),
    [status, user, error, token, signIn, signOut, getAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
