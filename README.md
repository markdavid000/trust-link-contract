# TrustLink — Soroban Escrow Contract

> **Trustless commerce on Stellar. Every transaction protected by code, not promises.**

[![Stellar](https://img.shields.io/badge/Stellar-Soroban-7B68EE?style=flat-square&logo=stellar)](https://stellar.org)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?style=flat-square&logo=rust)](https://rustup.rs)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Overview

The TrustLink Escrow Contract is the **trustless vault** of the TrustLink protocol. It holds Stellar assets (USDC and other SEP-41 tokens) in escrow and releases them only when verifiable conditions are met — buyer confirms delivery, dispute resolver decides, or the shipping window expires.

Buyers and sellers never meet. The contract handles the trust gap.

---

## State Machine

```
  create_escrow()
       |
       v
  ┌─────────┐   fund_escrow()   ┌────────┐   mark_shipped()   ┌─────────┐
  │ PENDING │─────────────────▶ │ FUNDED │──────────────────▶ │ SHIPPED │
  └────┬────┘                   └────┬───┘                    └────┬────┘
       │                             │                      ┌──────┴──────┐
       │ cancel_escrow()        raise_dispute()      confirm_delivery() │
       │                             │                      │    raise_dispute()
       v                             v                      v          │
  ┌──────────┐                 ┌──────────┐           ┌──────────┐     │
  │CANCELLED │                 │ DISPUTED │           │COMPLETED │     │
  └──────────┘                 └────┬─────┘           └──────────┘     │
                                    │                                  │
                            resolve_dispute()                    auto_release()
                           ┌───────┴────────┐                         │
                           v                v                         v
                     ┌──────────┐    ┌──────────┐              ┌──────────┐
                     │COMPLETED │    │ REFUNDED │              │COMPLETED │
                     └──────────┘    └──────────┘              └──────────┘
```

Key rules:
- **Pending**: seller cancels freely (no money moved)
- **Funded → Shipped**: only seller can mark shipped
- **Shipped → Completed**: buyer confirms delivery, funds release to seller
- **Funded or Shipped → Disputed**: buyer raises dispute
- **Shipped → Completed (auto)**: anyone triggers after `shipped_at + shipping_window` elapses
- **Disputed → Completed/Refunded**: only the `resolver` address decides

---

## Contract Functions

| Function | Auth | Description |
|---|---|---|
| `create_escrow(seller, resolver, token, amount, shipping_window)` | seller | Creates escrow, assigns sequential `u32` ID. Buyer unknown until funding. |
| `fund_escrow(escrow_id, buyer)` | buyer | Transfers `amount` tokens from buyer to contract, sets `funded_at`. |
| `mark_shipped(escrow_id)` | seller | Sets state to `Shipped`, starts delivery clock at `shipped_at`. |
| `confirm_delivery(escrow_id)` | buyer | Transfers tokens from contract to seller, state → `Completed`. |
| `raise_dispute(escrow_id)` | buyer | Freezes funds, state → `Disputed`. Works from `Funded` or `Shipped`. |
| `resolve_dispute(escrow_id, release_to_seller)` | resolver | Transfers to seller or refunds buyer. |
| `auto_release(escrow_id)` | anyone | After `shipped_at + window`, releases to seller. |
| `cancel_escrow(escrow_id)` | seller | Only in `Pending` state (no funds moved). |
| `get_escrow(escrow_id) → EscrowData` | none | Read-only view. |

---

## Data Structures

```rust
pub struct EscrowData {
    pub seller: Address,           // creator
    pub buyer: Option<Address>,    // set when funded, None during Pending
    pub resolver: Address,         // dispute admin key
    pub token: Address,            // Stellar asset contract (USDC etc.)
    pub amount: i128,              // raw units (incl. decimals)
    pub shipping_window: u64,      // seconds after shipped_at for auto-release
    pub funded_at: u64,            // ledger timestamp when funded (0 if pending)
    pub shipped_at: u64,           // ledger timestamp when shipped (0 if not shipped)
    pub created_at: u64,           // ledger timestamp of creation
    pub state: EscrowState,
}

pub enum EscrowState {
    Pending,
    Funded,
    Shipped,
    Completed,
    Disputed,
    Refunded,
    Cancelled,
}
```

---

## Getting Started

### Prerequisites

- Rust 1.75+
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli) 21+
- wasm32v1-none target (`rustup target add wasm32v1-none`)

### Build & Test

```bash
# Build for Soroban
cargo build --target wasm32v1-none -p trustlink-escrow

# Run all 16 tests
cargo test -p trustlink-escrow
```

### Deploy to Testnet

```bash
stellar keys generate --global deployer --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/trustlink_escrow.wasm \
  --source deployer \
  --network testnet

# → outputs CONTRACT_ID, save it
```

### Invoke Examples

```bash
# Create escrow (buyer unknown yet)
stellar contract invoke \
  --id $CONTRACT_ID --source seller --network testnet -- \
  create_escrow \
  --seller $SELLER_ADDR \
  --resolver $RESOLVER_ADDR \
  --token $USDC_CONTRACT \
  --amount 50000000 \
  --shipping_window 604800

# Fund escrow (buyer connects wallet)
stellar contract invoke \
  --id $CONTRACT_ID --source buyer --network testnet -- \
  fund_escrow \
  --escrow_id 1 \
  --buyer $BUYER_ADDR

# Mark shipped
stellar contract invoke \
  --id $CONTRACT_ID --source seller --network testnet -- \
  mark_shipped \
  --escrow_id 1
```

---

## Test Coverage (16 tests)

| Test | What it verifies |
|---|---|
| `test_create_escrow` | All fields set correctly, id increments |
| `test_fund_escrow` | Tokens move to contract, state → Funded |
| `test_mark_shipped` | State → Shipped, shipped_at set |
| `test_confirm_delivery` | Full happy path: create → fund → ship → confirm |
| `test_raise_dispute_after_funded` | Dispute from Funded state |
| `test_raise_dispute_after_shipped` | Dispute from Shipped state |
| `test_raise_and_resolve_dispute_release_to_seller` | Resolver releases to seller |
| `test_raise_and_resolve_dispute_refund_buyer` | Resolver refunds buyer |
| `test_auto_release` | Auto-release after shipping window elapses |
| `test_cancel_escrow` | Cancel in Pending state |
| `test_fund_non_pending_escrow_fails` | Double-fund prevention |
| `test_confirm_delivery_before_shipped_fails` | Can't confirm before ship |
| `test_auto_release_before_window_fails` | Can't auto-release too early |
| `test_auto_release_before_shipped_fails` | Can't auto-release before shipped |
| `test_cancel_after_fund_fails` | Can't cancel after funding |
| `test_multiple_escrows` | Independent escrows, correct balances |

---

## Project Structure

```
contracts/escrow/
├── Cargo.toml
└── src/
    ├── lib.rs       # Contract + events + storage (single module)
    └── test.rs      # All 16 tests
```

---

## Security Notes

- **Re-entrancy**: Soroban's execution model prevents re-entrancy by design.
- **Access control**: Every state-mutating function validates auth via `require_auth()`.
- **Overflow**: Arithmetic uses `i128` with Soroban's checked operations.
- **No admin key**: The dispute `resolver` is set per-escrow at creation, not a global key.

> This contract has not been formally audited. Use on mainnet at your own risk.

---

## Roadmap

- [x] Core escrow state machine (Pending → Funded → Shipped → Completed / Disputed)
- [x] SEP-41 token support (USDC, native assets)
- [x] Auto-release after shipping window
- [x] Dispute + resolver flow
- [x] Escrow cancellation
- [ ] Multi-asset support with per-escrow token choice
- [ ] Buyer-initiated refund before shipment
- [ ] On-chain dispute evidence hash
- [ ] Formal security audit

---

## License

MIT © TrustLink Contributors
