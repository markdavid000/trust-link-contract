// NOTE: this file is the checked-in TypeScript mirror of the contract's
// public types (storage data, query results, and event payloads), as
// declared in contracts/escrow/src/{types.rs,errors.rs,events.rs,lib.rs}.
//
// Regenerate with `npm run generate` after any contract ABI change (see
// bindings/README.md), and CI will fail the build if this file drifts out
// of sync with a freshly-built contract.

export type AddressLike = string;
export type ContractSymbol = string;
export type Bytes32 = Uint8Array;
export type Result<T> = T | null;

// ── Enums ────────────────────────────────────────────────────────────────────

export enum EscrowState {
  Pending = "Pending",
  Funded = "Funded",
  Shipped = "Shipped",
  Completed = "Completed",
  Disputed = "Disputed",
  Refunded = "Refunded",
  Canceled = "Canceled",
}

export enum DisputeStatus {
  Active = "Active",
  Resolved = "Resolved",
}

export enum ResolutionType {
  Release = "Release",
  Refund = "Refund",
}

/// Mirrors contracts/escrow/src/errors.rs::ContractError exactly. These
/// numeric values are part of the public ABI and must not be renumbered -
/// keep this enum's values in lockstep with the Rust source.
export enum ContractError {
  InvalidAmount = 1,
  InsufficientBalance = 2,
  EscrowNotFound = 3,
  InvalidState = 4,
  NotAuthorized = 5,
  AlreadyInitialized = 6,
  FeeExceedsMax = 7,
  EscrowHasNoBuyer = 8,
  ShippingWindowNotElapsed = 9,
  InvalidEvidenceHash = 10,
  DisputeNotFound = 11,
  ArithmeticError = 12,
  DeliveryBeforeDisputeWindow = 13,
  ContractPaused = 14,
  ArithmeticOverflow = 15,
  InvalidStateTransition = 16,
  InputTooLong = 17,
  InvalidAddress = 18,
  SameAddress = 19,
  AmountExceedsMaximum = 20,
  InvalidTrackingId = 21,
  DeliveryNotRecorded = 22,
  ConflictingRoles = 23,
  DisputeWindowClosed = 24,
  EmptyMilestones = 25,
  TooManyMilestones = 26,
  MilestoneNotFound = 27,
  MilestoneAlreadyReleased = 28,
  NotMilestoneEscrow = 29,
}

// ── Config / fee types ──────────────────────────────────────────────────────

export interface FeeConfig {
  protocol_fee_bps: number;
  arbitration_fee_bps: number;
}

/** Public-safe contract configuration (no sensitive addresses). */
export interface PublicContractConfig {
  fee_bps: number;
  paused: boolean;
  escrow_count: bigint;
}

/** Full contract configuration including privileged addresses. */
export interface ContractConfig {
  admin: AddressLike;
  fee_bps: number;
  fee_collector: AddressLike;
  escrow_count: bigint;
}

/** On-chain counters for escrow lifecycle events. */
export interface ContractStats {
  total_created: bigint;
  total_completed: bigint;
  total_disputed: bigint;
  total_refunded: bigint;
}

// ── Core escrow / dispute / milestone data ──────────────────────────────────

/** A single stage of a milestone-based escrow. */
export interface Milestone {
  amount: bigint;
  released: boolean;
}

export interface EscrowData {
  seller: AddressLike;
  buyer: AddressLike | null;
  resolver: AddressLike;
  token: AddressLike;
  amount: bigint;
  fee_bps: number;
  shipping_window: bigint;
  funded_at: bigint;
  dispute_deadline: bigint;
  shipped_at: bigint;
  delivered_at: bigint | null;
  tracking_id: string | null;
  state: EscrowState;
  /** `null` unless this escrow was created via `create_milestone_escrow`. */
  milestones: Milestone[] | null;
}

export interface DisputeData {
  escrow_id: bigint;
  reason: ContractSymbol;
  description: string;
  evidence_hash: Bytes32;
  status: DisputeStatus;
  disputed_at: bigint;
  tracking_id: string | null;
}

// ── Event payloads ───────────────────────────────────────────────────────────
// One interface per event published via env.events().publish(...) in
// contracts/escrow/src/events.rs. Field order matches the Rust struct.

export interface FeeUpdated {
  old_fee_bps: number;
  new_fee_bps: number;
  timestamp: bigint;
}

export interface ProtocolFeeUpdated {
  old_fee_bps: number;
  new_fee_bps: number;
  timestamp: bigint;
}

export interface ArbitrationFeeUpdated {
  old_fee_bps: number;
  new_fee_bps: number;
  timestamp: bigint;
}

export interface AdminRotated {
  old_admin: AddressLike;
  new_admin: AddressLike;
  timestamp: bigint;
}

export interface ContractPausedEvent {
  admin: AddressLike;
  timestamp: bigint;
}

export interface ContractUnpausedEvent {
  admin: AddressLike;
  timestamp: bigint;
}

export interface FeesWithdrawn {
  token: AddressLike;
  to: AddressLike;
  amount: bigint;
  timestamp: bigint;
}

export interface EscrowCreated {
  escrow_id: bigint;
  seller: AddressLike;
  resolver: AddressLike;
  token: AddressLike;
  amount: bigint;
  fee_bps: number;
  shipping_window: bigint;
  timestamp: bigint;
}

export interface EscrowFunded {
  escrow_id: bigint;
  buyer: AddressLike;
  amount: bigint;
  funded_at: bigint;
}

export interface EscrowShipped {
  escrow_id: bigint;
  seller: AddressLike;
  tracking_id: string;
  shipped_at: bigint;
}

export interface DeliveryRecorded {
  escrow_id: bigint;
  delivered_at: bigint;
}

export interface EscrowCompleted {
  escrow_id: bigint;
  recipient: AddressLike;
  amount: bigint;
  fee_bps: number;
  completed_at: bigint;
}

export interface DisputeRaised {
  escrow_id: bigint;
  buyer: AddressLike;
  reason: ContractSymbol;
  description: string;
  evidence_hash: Bytes32;
  disputed_at: bigint;
}

export interface DisputeResolved {
  escrow_id: bigint;
  resolver: AddressLike;
  resolution: ResolutionType;
  recipient: AddressLike;
  amount: bigint;
  arbitration_fee: bigint;
  resolved_at: bigint;
}

export interface AutoReleased {
  escrow_id: bigint;
  seller: AddressLike;
  amount: bigint;
  fee_bps: number;
  released_at: bigint;
}

export interface EscrowCancelled {
  escrow_id: bigint;
  seller: AddressLike;
  cancelled_at: bigint;
}

export interface ContractInitialized {
  admin: AddressLike;
  fee_collector: AddressLike;
  arbitration_fee_bps: number;
  timestamp: bigint;
}

export interface ResolverRotated {
  escrow_id: bigint;
  old_resolver: AddressLike;
  new_resolver: AddressLike;
  rotated_at: bigint;
}

export interface MilestoneEscrowCreated {
  escrow_id: bigint;
  milestone_count: number;
  total_amount: bigint;
  timestamp: bigint;
}

export interface MilestoneReleased {
  escrow_id: bigint;
  milestone_index: number;
  seller: AddressLike;
  amount: bigint;
  remaining_milestones: number;
  released_at: bigint;
}
