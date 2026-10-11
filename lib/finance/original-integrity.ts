import {createHash, timingSafeEqual} from 'node:crypto'
/** A fingerprint failure must never return altered bytes as original evidence. */
export function verifyOriginal(bytes:ArrayBuffer, expected:unknown):boolean {
 if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))return false
 const actual=createHash('sha256').update(Buffer.from(bytes)).digest()
 return timingSafeEqual(actual,Buffer.from(expected,'hex'))
}
