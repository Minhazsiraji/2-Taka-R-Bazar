// Owner-approved Expo fixture reference: 88c65a008e3ee6669f6f386b86233ea00ef57d9c.
// Presentation data only; never sent to an API, database, cart or payment action.
export const previewProducts=[
 {id:'butter',name:'Premium Butter',nameBn:'প্রিমিয়াম বাটার',unit:'1 kg',price:1160,oldPrice:1240,stock:32,photo:'photo-1550583724-b2692b85b150'},
 {id:'ghee',name:'Pure Cow Ghee',nameBn:'খাঁটি গরুর ঘি',unit:'500 g',price:680,oldPrice:780,stock:20,photo:'photo-1474979266404-7eaacbcd87c5'},
 {id:'rice',name:'Chinigura Rice',nameBn:'চিনিগুড়া চাল',unit:'1 kg',price:145,oldPrice:165,stock:45,photo:'photo-1586201375761-83865001e31c'},
 {id:'eggs',name:'Farm Fresh Eggs',nameBn:'তাজা ডিম',unit:'12 pcs',price:145,oldPrice:165,stock:24,photo:'photo-1506976785307-8732e854ad03'},
] as const
export const previewDeals=[
 {id:'rice',price:135,joined:4,target:5,days:2},
 {id:'butter',price:1075,joined:7,target:10,days:1},
] as const
export const previewPools=[
 {id:'weekly',label:'Weekly Pool',labelBn:'মার্কেটিং পুল',name:'Weekly Family Essentials',nameBn:'সাপ্তাহিক পরিবারের বাজার',
  products:['butter','rice','eggs'],joined:875,target:1000,days:5,date:'23 Oct'},
 {id:'monthly',label:'Monthly Pool',labelBn:'মাসিক পুল',name:'Monthly Pantry Pool',nameBn:'মাসিক বাজার পুল',
  products:['rice','ghee','butter'],joined:1320,target:1500,days:18,date:'5 Nov'},
] as const
export const previewPhoto=(photo:string)=>'https://images.unsplash.com/'+photo+'?auto=format&fit=crop&w=600&q=85'
export const previewMoney=(value:number)=>'৳'+value.toLocaleString('en-BD')
