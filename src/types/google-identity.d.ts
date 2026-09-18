export interface GisTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

export interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

export interface GisTokenClientError {
  type: string
  message?: string
}

export interface GisTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GisTokenResponse) => void
  error_callback?: (error: GisTokenClientError) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GisTokenClientConfig) => GisTokenClient
          revoke: (accessToken: string, done?: () => void) => void
        }
      }
    }
  }
}
