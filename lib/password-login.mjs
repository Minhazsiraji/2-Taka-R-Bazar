import { toBdE164Phone } from './bd-phone.mjs'

export function passwordCredentials(form, allowEmail = false) {
  const email = String(form.get('email') ?? '').trim()
  const phoneInput = String(form.get('phone') ?? '').trim()
  const password = String(form.get('password') ?? '')
  if (!password || password.length > 256 || (email && phoneInput)) return null
  if (allowEmail && email) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    return { email, password }
  }
  const phone = toBdE164Phone(phoneInput)
  return !email && phone ? { phone, password } : null
}
