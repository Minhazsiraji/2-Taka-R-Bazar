// Pool schedules use Bangladesh civil time (Asia/Dhaka, UTC+06 year-round).
// A datetime-local browser field has NO timezone. Never pass its raw value
// straight to new Date(), which uses the runtime timezone (UTC on Vercel).
const BD_OFFSET_MS=6*60*60*1000
export const BANGLADESH_TIME_LABEL='Bangladesh time (UTC+06)'

/** Convert exact YYYY-MM-DDTHH:mm submitted in Bangladesh time to UTC ISO. */
export function bangladeshInputToUtc(value){
 if(value==null||value==='')return null
 if(typeof value!=='string')throw new RangeError('Enter a valid Bangladesh date and time.')
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
 if(!m)throw new RangeError('Enter date and time as YYYY-MM-DD HH:mm (Bangladesh time).')
 const [year,month,day,hour,minute,second]=m.slice(1).map(Number)
 if(year<1900||year>9998||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)
  throw new RangeError('Invalid Bangladesh date or time.')
 const localEpoch=Date.UTC(year,month-1,day,hour,minute,second||0)
 const roundtrip=new Date(localEpoch).toISOString().slice(0,19)
 const expected=value.slice(0,16)+':'+String(second||0).padStart(2,'0')
 if(roundtrip!==expected)throw new RangeError('Invalid Bangladesh calendar date.')
 return new Date(localEpoch-BD_OFFSET_MS).toISOString()
}

/** Convert a stored UTC timestamp to datetime-local input value for Bangladesh. */
export function utcToBangladeshInput(value){
 if(value==null||value==='')return ''
 const epoch=Date.parse(value)
 if(!Number.isFinite(epoch))throw new RangeError('Invalid saved Pool timestamp.')
 return new Date(epoch+BD_OFFSET_MS).toISOString().slice(0,16)
}

export function displayBangladeshDateTime(value){
 if(!value)return '—'
 const epoch=Date.parse(value)
 if(!Number.isFinite(epoch))return '—'
 return new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(epoch)
}

export function displayBangladeshDate(value){
 if(!value)return '—'
 const epoch=Date.parse(value)
 if(!Number.isFinite(epoch))return '—'
 return new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeZone:'Asia/Dhaka'}).format(epoch)
}
