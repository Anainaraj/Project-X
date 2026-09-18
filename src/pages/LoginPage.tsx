import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { status, error, signIn } = useAuth()
  const isAuthenticating = status === 'authenticating'

  return (
    <main className="login-page">
      <h1>Project X</h1>
      <p>
        Sign in with Google to upload photos to your Drive, log them to a
        Sheet, and view them on a map.
      </p>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={isAuthenticating}
        aria-busy={isAuthenticating}
      >
        {isAuthenticating ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p role="alert" className="login-page__error">
          {error.message}
        </p>
      )}
      <p className="login-page__note">
        This app only requests access to a Drive folder it creates for you,
        plus your basic Google profile — not your entire Drive.
      </p>
    </main>
  )
}
