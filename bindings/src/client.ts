import {
  type AddressLike,
  type ContractConfig,
  type ContractStats,
  type ContractSymbol,
  type DisputeData,
  type EscrowData,
  type FeeConfig,
  type PublicContractConfig,
  type ResolutionType,
} from "./types.js";

export interface ContractTransport {
  invoke<TReturn>(
    method: string,
    args: readonly unknown[]
  ): TReturn | Promise<TReturn>;
}

export class EscrowClient {
  constructor(private readonly transport: ContractTransport) {}

  initialize(
    admin: AddressLike,
    feeCollector: AddressLike,
    arbitrationFeeBps: number
  ): void | Promise<void> {
    return this.transport.invoke("initialize", [
      admin,
      feeCollector,
      arbitrationFeeBps,
    ]);
  }

  pause_contract(): void | Promise<void> {
    return this.transport.invoke("pause_contract", []);
  }

  unpause_contract(): void | Promise<void> {
    return this.transport.invoke("unpause_contract", []);
  }

  is_paused(): boolean | Promise<boolean> {
    return this.transport.invoke("is_paused", []);
  }

  set_admin(newAdmin: AddressLike): void | Promise<void> {
    return this.transport.invoke("set_admin", [newAdmin]);
  }

  set_fee(caller: AddressLike, feeBps: number): void | Promise<void> {
    return this.transport.invoke("set_fee", [caller, feeBps]);
  }

  set_protocol_fee(caller: AddressLike, feeBps: number): void | Promise<void> {
    return this.transport.invoke("set_protocol_fee", [caller, feeBps]);
  }

  set_ttl_extension(
    caller: AddressLike,
    ledgers: number
  ): void | Promise<void> {
    return this.transport.invoke("set_ttl_extension", [caller, ledgers]);
  }

  withdraw_fees(
    caller: AddressLike,
    token: AddressLike,
    to: AddressLike,
    amount: bigint
  ): void | Promise<void> {
    return this.transport.invoke("withdraw_fees", [caller, token, to, amount]);
  }

  set_fee_collector(newCollector: AddressLike): void | Promise<void> {
    return this.transport.invoke("set_fee_collector", [newCollector]);
  }

  create_escrow(
    seller: AddressLike,
    buyer: AddressLike | null,
    resolver: AddressLike,
    token: AddressLike,
    amount: bigint,
    feeBps: number,
    shippingWindow: bigint
  ): bigint | Promise<bigint> {
    return this.transport.invoke("create_escrow", [
      seller,
      buyer,
      resolver,
      token,
      amount,
      feeBps,
      shippingWindow,
    ]);
  }

  /** Stages the escrow's total across multiple sequential payouts instead
   * of one lump sum - see release_milestone. The total is the sum of
   * milestoneAmounts; there is no separate total parameter. */
  create_milestone_escrow(
    seller: AddressLike,
    buyer: AddressLike | null,
    resolver: AddressLike,
    token: AddressLike,
    milestoneAmounts: bigint[],
    feeBps: number,
    shippingWindow: bigint
  ): bigint | Promise<bigint> {
    return this.transport.invoke("create_milestone_escrow", [
      seller,
      buyer,
      resolver,
      token,
      milestoneAmounts,
      feeBps,
      shippingWindow,
    ]);
  }

  fund_escrow(escrowId: bigint, buyer: AddressLike): void | Promise<void> {
    return this.transport.invoke("fund_escrow", [escrowId, buyer]);
  }

  raise_dispute(
    caller: AddressLike,
    escrowId: bigint,
    reason: ContractSymbol,
    description: string,
    evidenceHash: Uint8Array
  ): void | Promise<void> {
    return this.transport.invoke("raise_dispute", [
      caller,
      escrowId,
      reason,
      description,
      evidenceHash,
    ]);
  }

  cancel_escrow(caller: AddressLike, escrowId: bigint): void | Promise<void> {
    return this.transport.invoke("cancel_escrow", [caller, escrowId]);
  }

  mark_shipped(
    caller: AddressLike,
    escrowId: bigint,
    trackingId: string
  ): void | Promise<void> {
    return this.transport.invoke("mark_shipped", [
      caller,
      escrowId,
      trackingId,
    ]);
  }

  record_delivery(caller: AddressLike, escrowId: bigint): void | Promise<void> {
    return this.transport.invoke("record_delivery", [caller, escrowId]);
  }

  confirm_delivery(
    caller: AddressLike,
    escrowId: bigint
  ): void | Promise<void> {
    return this.transport.invoke("confirm_delivery", [caller, escrowId]);
  }

  /** Releases one stage of a milestone escrow to the seller. Returns
   * MilestoneAlreadyReleased (ErrorCode 28) if milestoneIndex was already
   * released - releases are not replayable. */
  release_milestone(
    caller: AddressLike,
    escrowId: bigint,
    milestoneIndex: number
  ): void | Promise<void> {
    return this.transport.invoke("release_milestone", [
      caller,
      escrowId,
      milestoneIndex,
    ]);
  }

  resolve_dispute(
    caller: AddressLike,
    escrowId: bigint,
    resolution: ResolutionType
  ): void | Promise<void> {
    return this.transport.invoke("resolve_dispute", [
      caller,
      escrowId,
      resolution,
    ]);
  }

  set_arbitration_fee(
    caller: AddressLike,
    feeBps: number
  ): void | Promise<void> {
    return this.transport.invoke("set_arbitration_fee", [caller, feeBps]);
  }

  get_arbitration_fee(): number | Promise<number> {
    return this.transport.invoke("get_arbitration_fee", []);
  }

  get_total_arbitration_fees(token: AddressLike): bigint | Promise<bigint> {
    return this.transport.invoke("get_total_arbitration_fees", [token]);
  }

  auto_release(escrowId: bigint): void | Promise<void> {
    return this.transport.invoke("auto_release", [escrowId]);
  }

  get_escrow(escrowId: bigint): EscrowData | Promise<EscrowData> {
    return this.transport.invoke("get_escrow", [escrowId]);
  }

  get_dispute(
    escrowId: bigint
  ): DisputeData | null | Promise<DisputeData | null> {
    return this.transport.invoke("get_dispute", [escrowId]);
  }

  get_escrows_by_buyer(buyer: AddressLike): bigint[] | Promise<bigint[]> {
    return this.transport.invoke("get_escrows_by_buyer", [buyer]);
  }

  get_escrows_by_vendor(vendor: AddressLike): bigint[] | Promise<bigint[]> {
    return this.transport.invoke("get_escrows_by_vendor", [vendor]);
  }

  get_stats(): ContractStats | Promise<ContractStats> {
    return this.transport.invoke("get_stats", []);
  }

  get_public_config(): PublicContractConfig | Promise<PublicContractConfig> {
    return this.transport.invoke("get_public_config", []);
  }

  get_contract_config(): ContractConfig | Promise<ContractConfig> {
    return this.transport.invoke("get_contract_config", []);
  }

  get_fee_config(): FeeConfig | Promise<FeeConfig> {
    return this.transport.invoke("get_fee_config", []);
  }

  rotate_resolver(
    caller: AddressLike,
    escrowId: bigint,
    newResolver: AddressLike
  ): void | Promise<void> {
    return this.transport.invoke("rotate_resolver", [
      caller,
      escrowId,
      newResolver,
    ]);
  }
}
