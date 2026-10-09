/** Read-only diagnostic for 2TBR unit economics. Never posts journals.
 * Amounts are BDT cents to avoid floating-point arithmetic. */
export type SaleLine={
 id:string;poolId:string;poolName:string;communityId:string;communityName:string;
 productId:string;productName:string;orderCount:number;quantity:number;
 benchmarkUnit:number;customerUnit:number;
 acceptedInvoiceQuantity:number;verifiedLandedUnit:number|null;
 invoiceRef:string;recordedSaleRevenue?:number;recordedCustomerSaving?:number;isCompleted:boolean;isPaymentReconciled:boolean;
 isRefundClear:boolean
}
export type ExpenseLine={category:string;amount:number;source:string}
export type ProfitInput={
 month:string;lines:SaleLine[];operatingExpenses:ExpenseLine[];
 deliveryRevenue:number;deliveryActualCost:number|null;
 financeCosts:number;taxRate:number|null;expensesFullyAllocated:boolean;
 journalSalesPosted:boolean;bankCollectionsMatched:boolean;
 inventoryLedgerMatched:boolean;taxPolicyVerified:boolean;isSynthetic:boolean
}
export type ProfitScope={poolId?:string;productId?:string}
export type ProfitResult={
 lines:(SaleLine&{saleRevenue:number;benchmarkValue:number;customerSaving:number;cogs:number|null;grossProfit:number|null;covered:boolean})[];
 quantity:number;productRevenue:number;customerSaving:number;cogs:number|null;
 grossProfit:number|null;deliveryRevenue:number|null;deliveryCost:number|null;
 operatingExpenses:number|null;financeCosts:number|null;
 profitBeforeTax:number|null;tax:number|null;illustrativeNetProfit:number|null;
 certifiedNetProfit:null;status:'SYNTHETIC_ILLUSTRATION'|'RECONCILIATION_REQUIRED';
 blockers:string[];scope:ProfitScope
}
const cents=(n:number)=>{if(!Number.isFinite(n)||n<0)throw new Error('Nonnegative finite BDT amount required');return Math.round(n*100)}
const round=(c:number)=>Math.round(c)/100
const signedCents=(n:number)=>{if(!Number.isFinite(n))throw new Error('Finite BDT amount required');return Math.round(n*100)}
const sum=(items:number[])=>items.reduce((a,b)=>a+b,0)
export function calculateProfit(input:ProfitInput,scope:ProfitScope={}):ProfitResult{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month))throw new Error('Invalid accounting month')
 const chosen=input.lines.filter(x=>(!scope.poolId||x.poolId===scope.poolId)&&(!scope.productId||x.productId===scope.productId))
 const scoped=Boolean(scope.poolId||scope.productId)
 const blockers:string[]=[]
 const rows=chosen.map(l=>{
  if(!Number.isInteger(l.quantity)||l.quantity<0||!Number.isInteger(l.acceptedInvoiceQuantity)||l.acceptedInvoiceQuantity<0)throw new Error('Invalid physical inventory quantity')
  const sold=l.recordedSaleRevenue===undefined?cents(l.customerUnit)*l.quantity:cents(l.recordedSaleRevenue)
  const benchmark=cents(l.benchmarkUnit)*l.quantity
  const saving=l.recordedCustomerSaving===undefined?Math.max(0,benchmark-sold):cents(l.recordedCustomerSaving)
  const covered=l.isCompleted&&l.isRefundClear&&l.verifiedLandedUnit!==null&&l.acceptedInvoiceQuantity>=l.quantity
  if(!l.isCompleted)blockers.push(l.productName+': completed fulfillment missing')
  if(!l.isRefundClear)blockers.push(l.productName+': refund or return unresolved')
  if(!l.isPaymentReconciled)blockers.push(l.productName+': customer collection is not bank/COD reconciled')
  if(l.verifiedLandedUnit===null||l.acceptedInvoiceQuantity<l.quantity)blockers.push(l.productName+': approved invoice and accepted inventory do not cover sold units')
  const cost=covered?cents(l.verifiedLandedUnit!)*l.quantity:null
  return {...l,saleRevenue:round(sold),benchmarkValue:round(benchmark),customerSaving:round(saving),
   cogs:cost===null?null:round(cost),grossProfit:cost===null?null:round(sold-cost),covered}
 })
 if(!rows.length)blockers.push('No fulfilled product order matches selected scope and month')
 const productRevenue=round(sum(rows.map(r=>cents(r.saleRevenue))))
 const customerSaving=round(sum(rows.map(r=>cents(r.customerSaving))))
 const cogs=rows.every(r=>r.covered)&&rows.length>0?round(sum(rows.map(r=>cents(r.cogs!)))):null
 const grossProfit=cogs===null?null:round(cents(productRevenue)-cents(cogs))
 if(scoped)blockers.push('Community/product costs and delivery/finance expenses require approved allocations; company net profit is only available at company-month scope')
 if(!input.expensesFullyAllocated)blockers.push('Company shared overhead allocation or approved expense coverage is incomplete')
 if(!input.journalSalesPosted)blockers.push('Revenue and COGS are not yet posted through approved double-entry financial journals')
 if(!input.inventoryLedgerMatched)blockers.push('Order-level stock-to-COGS inventory reconciliation is incomplete')
 if(!input.bankCollectionsMatched)blockers.push('COD suspense, customer collections and bank statements are not completely reconciled')
 if(!input.taxPolicyVerified)blockers.push('Approved income tax, VAT treatment and closing policy missing')
 const canCalculate=!scoped&&grossProfit!==null&&input.deliveryActualCost!==null&&input.expensesFullyAllocated
 const op=canCalculate?round(sum(input.operatingExpenses.map(x=>cents(x.amount)))):null
 const deliveryRevenue=scoped?null:round(cents(input.deliveryRevenue))
 const deliveryCost=scoped||input.deliveryActualCost===null?null:round(cents(input.deliveryActualCost))
 const financeCosts=scoped?null:round(cents(input.financeCosts))
 const profitBeforeTax=canCalculate?round(signedCents(grossProfit!)+cents(deliveryRevenue!)-cents(deliveryCost!)-cents(op!)-cents(financeCosts!)):null
 if(input.deliveryActualCost===null)blockers.push('Actual delivery operating cost is incomplete')
 const tax=profitBeforeTax!==null&&input.taxRate!==null&&input.taxRate>=0&&input.taxRate<=1
  ?round(Math.round(Math.max(0,signedCents(profitBeforeTax))*input.taxRate)):null
 if(input.taxRate===null)blockers.push('Income-tax computation not configured')
 // Never represent this as certified net profit until actual close journals,
 // refunds, allocations, payments, tax and controls have independent signoff.
 const illustrativeNetProfit=tax!==null&&profitBeforeTax!==null?round(signedCents(profitBeforeTax)-cents(tax)):null
 return {lines:rows,quantity:sum(rows.map(r=>r.quantity)),productRevenue,customerSaving,cogs,grossProfit,
  deliveryRevenue,deliveryCost,operatingExpenses:op,financeCosts,profitBeforeTax,tax,illustrativeNetProfit,
  certifiedNetProfit:null,status:input.isSynthetic?'SYNTHETIC_ILLUSTRATION':'RECONCILIATION_REQUIRED',
  blockers:[...new Set(blockers)],scope}
}
export type CashBridgeInput={
 openingCash:number;customerCod:number;deliveryCollections:number;supplierPayments:number;
 operatingCashPayments:number;loanPrincipalPaid:number;financeCashPaid:number;
 ownerFinancingInflows:number;otherExternalReceipts:number;internalTransfers:number;
 closingCash:number;cashAccountsReconciled:boolean
}
export function calculateCashBridge(input:CashBridgeInput){
 const keys=(Object.keys(input) as (keyof CashBridgeInput)[]).filter(k=>k!=='cashAccountsReconciled')
 for(const k of keys)cents(input[k] as number)
 const outsideIn=round(cents(input.customerCod)+cents(input.deliveryCollections)+cents(input.ownerFinancingInflows)+cents(input.otherExternalReceipts))
 const outsideOut=round(cents(input.supplierPayments)+cents(input.operatingCashPayments)+cents(input.loanPrincipalPaid)+cents(input.financeCashPaid))
 const netMovement=round(cents(outsideIn)-cents(outsideOut))
 const computedClosing=round(cents(input.openingCash)+cents(netMovement))
 const difference=round(cents(input.closingCash)-cents(computedClosing))
 return {...input,externalInflow:outsideIn,externalOutflow:outsideOut,netMovement,computedClosing,
  difference,reconciles:difference===0,cashStatus:difference===0&&input.cashAccountsReconciled?'BOOK_MATH_MATCHES_NOT_BANK_VERIFIED':'RECONCILIATION_REQUIRED',
  note:'Cash is not profit. Customer COD cash may remain a liability until order-level sales recognition; transfers between own accounts are not external cash flow.'}
}
