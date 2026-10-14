import {redirect} from 'next/navigation'

// Retired links cannot start or complete SMS authentication.
export default function RetiredVerificationPage() {
  redirect('/login?notice=Use+Google+or+mobile+and+password+to+sign+in')
}
