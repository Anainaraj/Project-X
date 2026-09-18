export type AppErrorCode =
  | 'AUTH_POPUP_CLOSED'
  | 'AUTH_ACCESS_DENIED'
  | 'AUTH_FAILED'
  | 'AUTH_SESSION_EXPIRED'
  | 'UNKNOWN'

export interface AppError {
  code: AppErrorCode
  message: string
  cause?: unknown
}
