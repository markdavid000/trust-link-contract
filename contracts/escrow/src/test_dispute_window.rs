#![cfg(test)]
//! `raise_dispute` must reject after the dispute window has elapsed (#22).
//!
//! Boundary semantics: the contract uses `timestamp >= dispute_deadline →
//! reject`, so a dispute at exactly the deadline must fail; one ledger second
//! before must succeed.

use crate::{ContractError, DataKey, Escrow, EscrowClient, EscrowData};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, BytesN, Env, String, Symbol,
};

struct Fx {
    env: Env,
    client: EscrowClient<'static>,
    contract_id: Address,
    buyer: Address,
    escrow_id: u64,
    dispute_deadline: u64,
}

fn setup_funded_and_shipped() -> Fx {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let resolver = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_addr = sac.address();

    let contract_id = env.register(Escrow, ());
    let client = EscrowClient::new(&env, &contract_id);
    client.initialize(&admin, &fee_collector, &0_i128);

    let amount: i128 = 1_000;
    let escrow_id = client.create_escrow(&seller, &resolver, &token_addr, &amount, &0_u32, &0_u64);
    token::StellarAssetClient::new(&env, &token_addr).mint(&buyer, &amount);
    client.fund_escrow(&escrow_id, &buyer);

    let tracking = String::from_str(&env, "TRK-001");
    client.mark_shipped(&seller, &escrow_id, &tracking);

    let data: EscrowData = env
        .as_contract(&contract_id, || env.storage().persistent().get(&DataKey::Escrow(escrow_id)))
        .expect("escrow exists");
    let dispute_deadline = data.dispute_deadline;

    Fx { env, client, contract_id, buyer, escrow_id, dispute_deadline }
}

fn try_raise(fx: &Fx) -> Result<Result<(), soroban_sdk::ConversionError>, Result<ContractError, soroban_sdk::InvokeError>> {
    let reason = Symbol::new(&fx.env, "non_delivery");
    let description = String::from_str(&fx.env, "missing");
    let evidence = BytesN::from_array(&fx.env, &[0xab; 32]);
    fx.client.try_raise_dispute(&fx.buyer, &fx.escrow_id, &reason, &description, &evidence)
}

#[test]
fn dispute_succeeds_within_window() {
    let fx = setup_funded_and_shipped();
    fx.env.ledger().with_mut(|li| li.timestamp = fx.dispute_deadline - 1);
    let result = try_raise(&fx);
    assert_eq!(result, Ok(Ok(())), "raise_dispute should succeed strictly before the deadline");
    let _ = fx.contract_id;
}

#[test]
fn dispute_fails_after_window_closes() {
    let fx = setup_funded_and_shipped();
    fx.env.ledger().with_mut(|li| li.timestamp = fx.dispute_deadline + 10);
    assert_eq!(try_raise(&fx), Err(Ok(ContractError::DisputeWindowClosed)));
}

#[test]
fn dispute_at_exact_deadline_is_rejected() {
    let fx = setup_funded_and_shipped();
    // The guard is `timestamp >= dispute_deadline`, so this is the first
    // rejected tick.
    fx.env.ledger().with_mut(|li| li.timestamp = fx.dispute_deadline);
    assert_eq!(try_raise(&fx), Err(Ok(ContractError::DisputeWindowClosed)));
}
