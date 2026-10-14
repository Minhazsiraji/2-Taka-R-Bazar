// Owner-supplied receiving details. This is configuration, not a payment gateway
// or authority to post cash, create an opening balance, or mark an order paid.
export const MANUAL_PAYMENT_DESTINATIONS = {
  bkash: {
    name: 'bKash Personal Retail Account (PRA)',
    accountNumber: '01636057401',
    displayNumber: '01636-057401',
    operation: 'Payment',
  },
  bank: {
    institution: 'The City Bank Plc',
    branch: 'Ashulia Branch',
    accountNumber: '2183503557001',
    accountHolder: 'Md. Minhaz Siraji',
  },
} as const
