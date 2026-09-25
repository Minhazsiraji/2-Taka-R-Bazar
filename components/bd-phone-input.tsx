'use client'

import { sanitizeBdPhoneInput } from '@/lib/bd-phone.mjs'

export function BdPhoneInput() {
  return (
    <label>
      <span className="label">Mobile number</span>
      <div className="flex">
        <span className="flex min-h-11 items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 px-3 font-bold text-slate-700">+88</span>
        <input
          className="input rounded-l-none"
          name="phone"
          onInput={(event) => {
            const input = event.currentTarget
            const cleaned = sanitizeBdPhoneInput(input.value)
            if (input.value !== cleaned) input.value = cleaned
          }}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="01404385101"
          pattern="01[3-9][0-9]{8}"
          maxLength={11}
          aria-describedby="phone-help"
          required
        />
      </div>
      <span id="phone-help" className="mt-1.5 block text-xs leading-5 text-slate-500">Paste 01404 385101, +8801404385101, or 8801404385101 — we’ll clean it automatically.</span>
    </label>
  )
}
