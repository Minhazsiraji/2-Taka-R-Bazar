export function passwordCredentials(form: Pick<FormData, 'get'>, allowEmail?: boolean): { email: string; password: string } | { phone: string; password: string } | null
