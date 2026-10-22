import {cookies} from 'next/headers'
import {CommerceContent} from '@/components/commerce-content'
import {commerceEnabled} from '@/lib/commerce/server'
import {STOREFRONT_LANGUAGE_COOKIE,isValidLanguagePreference,languageFromPreference} from '@/lib/storefront-language'
export async function CommerceFrame({children,title,error,launch=false}:{launch?:boolean;children?:React.ReactNode;title:string;error?:string}){const preference=(await cookies()).get(STOREFRONT_LANGUAGE_COOKIE)?.value;return <CommerceContent title={title} error={error} launch={launch} enabled={commerceEnabled()} initialLanguage={languageFromPreference(preference)} hasLanguageCookie={isValidLanguagePreference(preference)}>{children}</CommerceContent>}
