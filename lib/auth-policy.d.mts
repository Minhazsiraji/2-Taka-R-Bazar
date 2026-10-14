export function safeAuthReturnPath(value: string | null | undefined): string | null
export function authCallbackUrl(siteUrl?: string): string
export function authProviderStatus(settings: unknown): {available: boolean; google: boolean; mobileSignup: boolean; mobilePassword: boolean}
