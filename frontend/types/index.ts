export interface Plan {
  id: number;
  fee: string; // in XLM (formatted as decimal string)
  feeStroops: string; // in stroops (i128 represented as string)
  interval: number; // in seconds
  name: string;
}

export interface Subscription {
  user: string;
  planId: number;
  startTime: number; // unix timestamp
  nextPaymentDue: number; // unix timestamp
  active: boolean;
}
