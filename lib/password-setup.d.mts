export const PASSWORD_SETUP_WINDOW_SECONDS: number
export function hasRecentAuthentication(claims: unknown, nowSeconds?: number): boolean
export function passwordSetupError(password: unknown, confirmation: unknown): string | null
