import {PublicFooter} from '@/components/public-footer'
import {getCustomerLanguage} from '@/lib/customer-language'

export async function CustomerFooter(){
 return <PublicFooter {...await getCustomerLanguage()}/>
}
