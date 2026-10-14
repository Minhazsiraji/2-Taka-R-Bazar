import 'server-only'
import {cache} from 'react'
import {cookies} from 'next/headers'
import {STOREFRONT_LANGUAGE_COOKIE,isValidLanguagePreference,languageFromPreference} from '@/lib/storefront-language'

export const getCustomerLanguage=cache(async()=>{
 const preference=(await cookies()).get(STOREFRONT_LANGUAGE_COOKIE)?.value
 return {initialLanguage:languageFromPreference(preference),hasLanguageCookie:isValidLanguagePreference(preference)}
})
