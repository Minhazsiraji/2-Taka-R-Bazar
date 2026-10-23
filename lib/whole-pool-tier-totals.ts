/**
 * Pool tiers are bundle-wide. Sum every selected product at the SAME threshold;
 * do not advertise the cheapest product or largest single-item discount as Pool savings.
 */
export type WholePoolLine={retail:number|null;opening:number|null;current:number|null;quantity?:number;steps:readonly {minimum:number;price:number}[]}
export type WholePoolStage={target:number;total:number;savings:number|null}
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const valid=(n:number|null)=>typeof n==='number'&&Number.isFinite(n)&&n>0
const sum=(values:(number|null)[]):number|null=>values.every(valid)?cents(values.reduce<number>((s,v)=>s+(v??0),0)):null
export function wholePoolTierTotals(lines:readonly WholePoolLine[],joined=0):{
 retail:number|null;opening:number|null;current:number|null;next:WholePoolStage|null;stages:WholePoolStage[]
}{
 const quantitiesValid=lines.every(l=>Number.isInteger(l.quantity??1)&&(l.quantity??1)>0&&(l.quantity??1)<=100)
 const retail=quantitiesValid?sum(lines.map(l=>valid(l.retail)?l.retail!*(l.quantity??1):null)):null
 const opening=quantitiesValid?sum(lines.map(l=>valid(l.opening)?l.opening!*(l.quantity??1):null)):null
 const current=quantitiesValid?sum(lines.map(l=>valid(l.current)?l.current!*(l.quantity??1):null)):null
 if(!lines.length)return {retail:null,opening:null,current:null,next:null,stages:[]}
 const levels=[...new Set(lines.flatMap(l=>l.steps.map(s=>s.minimum)))].filter(threshold=>
  Number.isInteger(threshold)&&threshold>0&&lines.every(l=>l.steps.some(s=>s.minimum===threshold)))
  .sort((a,b)=>a-b)
 const stages:WholePoolStage[]=levels.flatMap(target=>{
  const total=quantitiesValid?sum(lines.map(l=>{const price=l.steps.find(s=>s.minimum===target)?.price;return valid(price??null)?price!*(l.quantity??1):null})):null
  return total===null?[]:[{target,total,savings:retail===null?null:cents(Math.max(0,retail-total))}]
 })
 return {retail,opening,current,next:stages.find(s=>s.target>joined)??null,stages}
}
