#![cfg(test)]

//! SEP-41 token compatibility tests.
//!
//! The contract stores the token address in `EscrowData.token` and instantiates
//! `token::Client` from that address at runtime in both `fund_escrow` and every
//! payout path (`deduct_and_transfer`).  These tests verify that the full
//! lifecycle works correctly with a generic SEP-41 token that is not USDC.

use crate::EscrowState;
use crate::test_helpers::setup_contract;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env, IntoVal, String as SorobanString, Symbol, TryFromVal, Val,
    BytesN,
};

/// Register a fresh Stellar asset contract (generic SEP-41 token).
fn register_sep41_token(env: &Env) -> Address {
    env.register_stellar_asset_contract(Address::generate(env))
}

fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token).mint(to, &amount);
}

fn balance(env: &Env, token: &Address, who: &Address) -> i128 {
    token::Client::new(env, token).balance(who)
}

fn has_event<T, F>(env: &Env, contract_id: &Address, topic: &str, predicate: F) -> bool
where
    T: TryFromVal<Env, Val>,
    F: Fn(&T) -> bool,
{
    let expected_topic = vec![&env, Symbol::new(env, topic).into_val(env)];
    env.events().all().into_iter().any(|(event_contract, topics, data)| {
        event_contract == *contract_id
            && topics == expected_topic
            && T::try_from_val(env, &data).map(|event| predicate(&event)).unwrap_or(false)
    })
}

#[test]
fn test_sep41_fund_and_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let token = register_sep41_token(&env);
    let (contract_id, client, _admin, _fee_collector) = setup_contract(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let resolver = Address::generate(&env);

    mint(&env, &token, &buyer, 500);

    let id = client.create_escrow(&seller, &resolver, &token, &500_i128, &100_u32, &3600_u64);
    client.fund_escrow(&id, &buyer);
    client.mark_shipped(&id, &SorobanString::from_str(&env, "TRACK001"));

    assert!(has_event::<crate::EscrowCreated, _>(&env, &contract_id, "escrow_created", |event| {
        event.escrow_id == id
    }));
    assert!(has_event::<crate::EscrowFunded, _>(&env, &contract_id, "escrow_funded", |event| {
        event.escrow_id == id && event.buyer == buyer
    }));
    assert!(has_event::<crate::EscrowShipped, _>(&env, &contract_id, "escrow_shipped", |event| {
        event.escrow_id == id && event.seller == seller
    }));

    assert_eq!(client.get_escrow(&id).state, EscrowState::Shipped);
    assert_eq!(balance(&env, &token, &buyer), 0);
    assert_eq!(balance(&env, &token, &contract_id), 500);

    env.ledger().set_timestamp(env.ledger().timestamp() + 172_801);
    client.confirm_delivery(&id);

    assert!(has_event::<crate::EscrowCompleted, _>(&env, &contract_id, "escrow_completed", |event| {
        event.escrow_id == id && event.recipient == seller
    }));

    // 1% fee on 500 = 5 retained; 495 to seller
    assert_eq!(balance(&env, &token, &seller), 495);
    assert_eq!(balance(&env, &token, &contract_id), 5);
    assert_eq!(client.get_escrow(&id).state, EscrowState::Completed);
}

#[test]
fn test_sep41_auto_release() {
    let env = Env::default();
    env.mock_all_auths();

    let token = register_sep41_token(&env);
    let (contract_id, client, _admin, _fee_collector) = setup_contract(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let resolver = Address::generate(&env);

    mint(&env, &token, &buyer, 1000);

    let id = client.create_escrow(&seller, &resolver, &token, &1000_i128, &0_u32, &3600_u64);
    client.fund_escrow(&id, &buyer);

    // Advance past dispute deadline (172800s) + shipping window (3600s)
    env.ledger().set_timestamp(env.ledger().timestamp() + 172_800 + 3_601);
    client.auto_release(&id);

    assert!(has_event::<crate::AutoReleased, _>(&env, &contract_id, "auto_released", |event| {
        event.escrow_id == id && event.seller == seller
    }));

    assert_eq!(balance(&env, &token, &seller), 1000);
    assert_eq!(balance(&env, &token, &contract_id), 0);
    assert_eq!(client.get_escrow(&id).state, EscrowState::Completed);
}

#[test]
fn test_sep41_dispute_and_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let token = register_sep41_token(&env);
    let (contract_id, client, _admin, _fee_collector) = setup_contract(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let resolver = Address::generate(&env);

    mint(&env, &token, &buyer, 800);

    let id = client.create_escrow(&seller, &resolver, &token, &800_i128, &0_u32, &3600_u64);
    client.fund_escrow(&id, &buyer);

    client.raise_dispute(
        &id,
        &Symbol::new(&env, "defective"),
        &SorobanString::from_str(&env, "item was broken"),
        &BytesN::from_array(&env, &[0xde; 32]),
    );

    assert!(has_event::<crate::DisputeRaised, _>(&env, &contract_id, "dispute_raised", |event| {
        event.escrow_id == id && event.buyer == buyer
    }));

    client.resolve_dispute(&id, &crate::ResolutionType::Refund);

    assert!(has_event::<crate::DisputeResolved, _>(&env, &contract_id, "dispute_resolved", |event| {
        event.escrow_id == id && event.resolution == crate::ResolutionType::Refund && event.recipient == buyer
    }));

    // Zero fee — full 800 back to buyer
    assert_eq!(balance(&env, &token, &buyer), 800);
    assert_eq!(balance(&env, &token, &contract_id), 0);
    assert_eq!(client.get_escrow(&id).state, EscrowState::Refunded);
}

#[test]
fn test_sep41_token_address_stored_in_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let token = register_sep41_token(&env);
    let (_contract_id, client, _admin, _fee_collector) = setup_contract(&env);

    let seller = Address::generate(&env);
    let resolver = Address::generate(&env);

    let id = client.create_escrow(&seller, &resolver, &token, &100_i128, &0_u32, &3600_u64);
    // Verify the stored token address matches what was passed in
    assert_eq!(client.get_escrow(&id).token, token);
}
