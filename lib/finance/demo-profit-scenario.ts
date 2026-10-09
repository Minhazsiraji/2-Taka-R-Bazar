/** Synthetic AMT-01 illustration. No real users, supplier bank accounts, or money.
 * The supplier PO demo cost is 950 BDT, so product gross margin is ZERO;
 * do not substitute the unnegotiated 900 BDT alternative as a verified cost.
 * Operating expense 2,780 is split: 2,480 overhead + 300 delivery cost.
 */
import type {ProfitInput,CashBridgeInput} from './profit-trace'
export const DEMO_PROFIT_MONTH='2026-10'
export const demoProfitInput:ProfitInput={
 month:'2026-10',
 lines:[{
  id:'syn-oil',poolId:'syn-pool-amt-01',poolName:'AMT-01 October Grocery Pool',
  communityId:'syn-amt-01',communityName:'Amin Model Town (AMT-01)',
  productId:'syn-oil-5l',productName:'Soybean Oil 5 L',
  orderCount:95,quantity:95,benchmarkUnit:1000,customerUnit:950,
  acceptedInvoiceQuantity:95,verifiedLandedUnit:950,invoiceRef:'SYN-INV-OIL-70 + SYN-INV-OIL-25',
  isCompleted:true,isPaymentReconciled:false,isRefundClear:true,
 }],
 operatingExpenses:[
  {category:'Offline QR marketing',amount:1200,source:'SYN-DEMO-QR-101'},
  {category:'Logistics & delivery support (excluding direct delivery cost)',amount:580,source:'SYN-DEMO-FRT-102'},
  {category:'Technology & infrastructure',amount:700,source:'SYN-DEMO-INF-104'},
 ],
 deliveryRevenue:400,
 deliveryActualCost:300,
 financeCosts:600,
 taxRate:0.15, // strictly an illustrative income tax assumption, NOT Bangladesh tax advice
 expensesFullyAllocated:true,
 journalSalesPosted:false,
 bankCollectionsMatched:false,
 inventoryLedgerMatched:false,
 taxPolicyVerified:false,
 isSynthetic:true,
}
export const demoCashBridge:CashBridgeInput={
 openingCash:255140,
 customerCod:16000,
 deliveryCollections:360,
 supplierPayments:66500,
 operatingCashPayments:1200,
 loanPrincipalPaid:10000,
 financeCashPaid:600,
 ownerFinancingInflows:0,
 otherExternalReceipts:0,
 internalTransfers:10000,
 closingCash:193200,
 cashAccountsReconciled:false
}
export const DEMO_PO_FACTS={
 ordered:100,accepted:95,unitCost:950,
 firstBilledQty:70,firstBilledAmount:66500,
 secondBilledQty:25,secondBilledAmount:23750,
 remainingSupplierPayable:23750,
 cashOperatingReserve:100000,
} as const
export const demoSelection={
 communities:[{id:'syn-amt-01',name:'Amin Model Town (AMT-01)'},{id:'syn-dohs',name:'Savar DOHS'}],
 pools:[{id:'syn-pool-amt-01',name:'AMT-01 October Grocery Pool',communityId:'syn-amt-01'},
  {id:'syn-pool-dohs',name:'Savar DOHS October Pool',communityId:'syn-dohs'}],
 products:[{id:'syn-oil-5l',name:'Soybean Oil 5 L'},{id:'syn-rice-10kg',name:'Miniket Rice 10 kg'}]
}
