import type {ProductContent} from './product-content';
export type Mode='SOLO'|'GROUP_DEAL'|'POOL';
export type Product={id:string;name:string;nameBn:string;unit:string;image:string;referencePrice:number;category:string;brand?:string;content?:ProductContent};
export type Offer={id:string;productId:string;mode:Mode;price:number;phase:'ready'|'waiting';groupSize?:3|5|10;joined?:number;exclusive?:boolean;poolId?:string;stock?:number;daysLeft?:number;community:string;openingPrice?:number;nextTierPrice?:number};
export type Pool={id:string;name:string;nameBn:string;frequency:'weekly'|'monthly';productIds:string[];participants:number;nextTier:number;commitDaysLeft?:number;commitEndsLabel?:string};
const photo=(id:string)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=600&q=85';
export const products:Product[]=[
 {id:'butter',name:'Premium Butter',nameBn:'প্রিমিয়াম বাটার',unit:'1 kg',image:photo('photo-1550583724-b2692b85b150'),referencePrice:1240,category:'Dairy'},
 {id:'rice',name:'Chinigura Rice',nameBn:'চিনিগুঁড়া চাল',unit:'1 kg',image:photo('photo-1586201375761-83865001e31c'),referencePrice:165,category:'Grocery'},
 {id:'ghee',name:'Pure Cow Ghee',nameBn:'খাঁটি গরুর ঘি',unit:'500 g',image:photo('photo-1474979266404-7eaacbcd87c5'),referencePrice:780,category:'Dairy'},
 {id:'eggs',name:'Farm Fresh Eggs',nameBn:'তাজা ডিম',unit:'12 pcs',image:photo('photo-1506976785307-8732e854ad03'),referencePrice:165,category:'Grocery'}
];
export const offers:Offer[]=[
 {id:'gd-butter',productId:'butter',mode:'GROUP_DEAL',price:1075,phase:'waiting',groupSize:10,joined:7,daysLeft:1,community:'Savar DOHS'},
 {id:'gd-rice',productId:'rice',mode:'GROUP_DEAL',price:135,phase:'waiting',groupSize:5,joined:4,daysLeft:2,community:'Savar DOHS'},
 {id:'solo-butter',productId:'butter',mode:'SOLO',price:1160,phase:'ready',exclusive:true,stock:32,community:'Savar DOHS'},
 {id:'solo-ghee',productId:'ghee',mode:'SOLO',price:680,phase:'ready',exclusive:true,stock:20,community:'Savar DOHS'},
 {id:'solo-rice',productId:'rice',mode:'SOLO',price:145,phase:'ready',exclusive:true,stock:45,community:'Savar DOHS'},
 {id:'solo-eggs',productId:'eggs',mode:'SOLO',price:145,phase:'ready',exclusive:true,stock:24,community:'Savar DOHS'},
 {id:'pool-butter',productId:'butter',mode:'POOL',price:1100,openingPrice:1160,nextTierPrice:1050,phase:'waiting',poolId:'weekly',community:'Savar DOHS'},
 {id:'pool-rice',productId:'rice',mode:'POOL',price:140,openingPrice:155,nextTierPrice:130,phase:'waiting',poolId:'weekly',community:'Savar DOHS'},
 {id:'pool-eggs',productId:'eggs',mode:'POOL',price:145,openingPrice:155,nextTierPrice:140,phase:'waiting',poolId:'weekly',community:'Savar DOHS'},
 {id:'pool-ghee',productId:'ghee',mode:'POOL',price:690,openingPrice:720,nextTierPrice:660,phase:'waiting',poolId:'monthly',community:'Savar DOHS'},
 {id:'pool-rice-monthly',productId:'rice',mode:'POOL',price:140,openingPrice:155,nextTierPrice:130,phase:'waiting',poolId:'monthly',community:'Savar DOHS'},
 {id:'pool-butter-monthly',productId:'butter',mode:'POOL',price:1100,openingPrice:1160,nextTierPrice:1050,phase:'waiting',poolId:'monthly',community:'Savar DOHS'}
];
export const pools:Pool[]=[
 {id:'weekly',name:'Weekly Family Essentials',nameBn:'সাপ্তাহিক পরিবারের বাজার',frequency:'weekly',productIds:['butter','rice','eggs'],participants:875,nextTier:1000,commitDaysLeft:5,commitEndsLabel:'23 Oct'},
 {id:'monthly',name:'Monthly Pantry Pool',nameBn:'মাসিক বাজার পুল',frequency:'monthly',productIds:['rice','ghee','butter'],participants:1320,nextTier:1500,commitDaysLeft:18,commitEndsLabel:'5 Nov'}
];
export const demoSavings={thisMonth:1250,lastMonth:1060,lifetime:8450,community:248620};
export type DemoOrderStatus='completed'|'preparing'|'in_transit'|'cancelled';
export type DemoOrder={
 id:string;status:DemoOrderStatus;date:string;items:string[];value:number;saving:number;channel:'exclusive'|'group'|'pool';units:Record<string,number>;
};
/** Illustrative only. All earned-savings examples are completed, net eligible orders.
 * These are not connected to real accounts, fulfillment, payment or user sessions. */
export const demoOrders:DemoOrder[]=[
 {id:'2T-DEMO-1002',status:'preparing',date:'2026-10-17',items:['ghee'],units:{ghee:1},value:680,saving:0,channel:'exclusive'},
 {id:'2T-DEMO-1001',status:'completed',date:'2026-10-15',items:['butter','rice'],units:{butter:1,rice:1},value:1210,saving:195,channel:'group'},
 {id:'2T-DEMO-0999',status:'completed',date:'2026-10-08',items:['butter','rice','eggs'],units:{butter:2,rice:2,eggs:3},value:5410,saving:1055,channel:'pool'},
 {id:'2T-DEMO-0997',status:'cancelled',date:'2026-10-06',items:['rice'],units:{rice:1},value:0,saving:0,channel:'group'},
 {id:'2T-DEMO-0915',status:'completed',date:'2026-09-20',items:['rice','ghee'],units:{rice:3,ghee:2},value:4250,saving:1060,channel:'pool'},
 {id:'2T-DEMO-0770',status:'completed',date:'2026-08-04',items:['butter','rice','eggs'],units:{butter:4,rice:6,eggs:5},value:27500,saving:6140,channel:'exclusive'}
];
