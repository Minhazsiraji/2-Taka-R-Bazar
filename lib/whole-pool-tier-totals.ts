/**
 * Pool tiers are bundle-wide. Sum every selected product at the SAME threshold;
 * do not advertise the cheapest product or largest single-item discount as Pool savings.
 */
export type WholePoolLine={retail:number|null;opening:number|null;current:number|null;steps:readonly {minimum:number;price:number}[]}
export type WholePoolStage={target:number;total:number;savings:number|null}
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const valid=(n:number|null)=>typeof n==='number'&&Number.isFinite(n)&&n>0
const sum=(values:(number|null)[]):number|null=>values.every(valid)?cents(values.reduce<number>((s,v)=>s+(v??0),0)):null
export function wholePoolTierTotals(lines:readonly WholePoolLine[],joined=0):{
 retail:number|null;opening:number|null;current:number|null;next:WholePoolStage|null;stages:WholePoolStage[]
}{
 const retail=sum(lines.map(l=>l.retail)),opening=sum(lines.map(l=>l.opening)),current=sum(lines.map(l=>l.current))
 if(!lines.length)return {retail:null,opening:null,current:null,next:null,stages:[]}
 const levels=[...new Set(lines.flatMap(l=>l.steps.map(s=>s.minimum)))].filter(threshold=>
  Number.isInteger(threshold)&&threshold>0&&lines.every(l=>l.steps.some(s=>s.minimum===threshold)))
  .sort((a,b)=>a-b)
 const stages:WholePoolStage[]=levels.flatMap(target=>{
  const total=sum(lines.map(l=>l.steps.find(s=>s.minimum===target)?.price??null))
  return total===null?[]:[{target,total,savings:retail===null?null:cents(Math.max(0,retail-total))}]
 })
 return {retail,opening,current,next:stages.find(s=>s.target>joined)??null,stages}
}
