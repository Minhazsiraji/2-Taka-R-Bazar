const bengali={'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
export function toBdE164Phone(raw){
 let digits=String(raw??'').replace(/[০-৯]/g,d=>bengali[d]).replace(/\D/g,'');
 if(digits.startsWith('0088'))digits=digits.slice(4);
 else if(digits.startsWith('88'))digits=digits.slice(2);
 if(digits.length===10&&/^1[3-9]/.test(digits))digits='0'+digits;
 return /^01[3-9]\d{8}$/.test(digits)?'+88'+digits:null;
}
export const validPassword=(p)=>typeof p==='string'&&p.length>0&&p.length<=256;
