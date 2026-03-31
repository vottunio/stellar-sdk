/**
 * WebSocket connection states.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * WebSocket event names.
 */
export type WebSocketEventName =
  | 'transaction.confirmed'
  | 'transaction.failed'
  | 'payment.received'
  | 'account.updated'
  | 'contract.event'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * Transaction confirmed event payload.
 */
export interface TransactionConfirmedEvent {
  hash: string;
  ledger: number;
  account: string;
  operations: unknown[];
}

/**
 * Transaction failed event payload.
 */
export interface TransactionFailedEvent {
  hash: string;
  error: string;
  account: string;
}

/**
 * Payment received event payload.
 */
export interface PaymentReceivedEvent {
  from: string;
  to: string;
  amount: string;
  asset: string;
  hash: string;
}

/**
 * Account updated event payload.
 */
export interface AccountUpdatedEvent {
  account: string;
  balances: unknown[];
  signers: unknown[];
}

/**
 * Contract event payload.
 */
export interface ContractEventPayload {
  contractId: string;
  topic: string[];
  data: unknown;
  ledger: number;
}

/**
 * WebSocket subscription filter.
 */
export interface SubscriptionFilter {
  events?: WebSocketEventName[];
  account?: string;
  asset?: string;
}

/**
 * Event handler type.
 */
export type EventHandler<T = unknown> = (payload: T) => void;
