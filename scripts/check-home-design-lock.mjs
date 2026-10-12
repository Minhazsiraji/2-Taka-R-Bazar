import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const lock=JSON.parse(readFileSync(new URL('../docs/approved-home-design-lock.json',import.meta.url),'utf8'))
const changed=Object.entries(lock.sha256).filter(([path,hash])=>createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')!==hash)
if(changed.length){console.error('Approved Home design changed:',changed.map(([p])=>p).join(', '));process.exit(1)}
console.log('Approved Home design lock passed')
