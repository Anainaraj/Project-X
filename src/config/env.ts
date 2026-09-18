function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export const env = {
  googleClientId: requireEnv('VITE_GOOGLE_CLIENT_ID'),
}
