# Google and mobile/password authentication — 14 October 2026

The owner requested removal of site OTP authentication after the SMS provider reported its trial expired/free units depleted. This release replaces SMS sign-in, registration and password verification with native Supabase password Auth and Google OAuth/identity linking. The retired `/verify-otp` route only redirects to login. No application action invokes `signInWithOtp` or `verifyOtp`.

Existing phone users save their password from their ordinary authenticated session at `/account/security`. Passwords are never set by privileged Auth SQL or an administrator in this release. Google must be linked from the existing signed-in owner or second real account to preserve its UUID, household and database-granted roles. New Google accounts receive only the default customer role; profile contact numbers are not identity or household verification.

## Hosted setup required

Repository `supabase/config.toml` applies to disposable local/CI Auth only. It does not configure hosted Supabase.

1. Project `sukabonfjcnaavjgjyuy`: keep Phone login enabled; turn **Confirm phone off**. New mobile signup and adding a mobile login identifier are denied by the app unless the public Auth settings explicitly return `external.phone=true` and `phone_autoconfirm=true`. Signup also requires `disable_signup=false`. This prevents unintended SMS requests while the old hosted settings remain.
2. Google Web OAuth client: JavaScript origin `https://2takarbazar.com`; authorised redirect URI `https://sukabonfjcnaavjgjyuy.supabase.co/auth/v1/callback`.
3. Enter the client ID and secret privately in Supabase's Google provider, enable it, and enable manual identity linking. Never commit or send the secret in chat.
4. Supabase Site URL `https://2takarbazar.com`; redirect allowlist `https://2takarbazar.com/auth/callback`.
5. While still signed in to each original account, save a password and link Google. Then sign out and test both methods. Google sign-in on an unlinked phone-only account creates a separate customer; it cannot inherit staff permissions by matching a contact number.

`/super-admin/auth-setup` displays current non-secret provider readiness and these instructions. Provider availability does not certify a successful Google OAuth round trip; the actual provider test remains pending private setup.

## Scope and verification

The app requires a normal authenticated user before password changes/linking and delegates password policy/current-password requirements to Supabase. OAuth uses PKCE exchange, safe internal return paths, configured site origin, and an identity-preservation check when linking. Missing/invalid/denied callback codes cannot grant a session or staff permissions. Referrals and community QR intent remain carried through onboarding; an already completed household cannot be moved by resubmitting onboarding.

The disposable Auth browser gate covers native mobile registration without SMS, referral/return intent, customer household onboarding, existing account password change, rejection of the previous password, stable UUID/phone/Super Admin role, guest denial, retired OTP route, disabled Google button and invalid OAuth callbacks. An ordinary email-only SDK session separately exercises the same contact-onboarding and mobile-login attachment behavior used by Google members, including rejection of a phone belonging to another account. This fixture is not represented as a real Google provider test.

Community/geolocation/household eligibility, Finance maker/checker permissions, existing real identities and Production commerce restrictions are unchanged. No SMS credit or paid provider subscription is purchased. Real product/payment cutover remains part of Issue #64 after owner data and qualification.
