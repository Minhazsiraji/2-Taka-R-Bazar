import {CustomerHeaderClient,type CustomerHeaderProps} from '@/components/customer-header-client'
import {getCustomerLanguage} from '@/lib/customer-language'

export async function CustomerHeader(props:CustomerHeaderProps){
 return <CustomerHeaderClient {...props} {...await getCustomerLanguage()}/>
}
