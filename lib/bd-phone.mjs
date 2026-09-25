const BANGLA_DIGITS = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
}

function toAsciiDigits(raw) {
  return String(raw ?? '')
    .replace(/[০-৯]/g, (digit) => BANGLA_DIGITS[digit] ?? digit)
    .replace(/\D/g, '')
}

function removeBangladeshPrefix(digits) {
  if (digits.startsWith('0088')) return digits.slice(4)
  if (digits.startsWith('88')) return digits.slice(2)
  return digits
}

export function sanitizeBdPhoneInput(raw) {
  let digits = removeBangladeshPrefix(toAsciiDigits(raw))
  if (digits.length === 10 && /^1[3-9]/.test(digits)) digits = `0${digits}`
  return digits.slice(0, 11)
}

export function normalizeBdLocalPhone(raw) {
  let digits = removeBangladeshPrefix(toAsciiDigits(raw))
  if (digits.length === 10 && /^1[3-9]/.test(digits)) digits = `0${digits}`
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null
}

export function toBdE164Phone(raw) {
  const local = normalizeBdLocalPhone(raw)
  return local ? `+88${local}` : null
}
