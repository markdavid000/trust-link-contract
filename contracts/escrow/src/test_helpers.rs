#![cfg(test)]

use crate::{Escrow, EscrowClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};
use crate::Payee;
use soroban_sdk::Vec;

pub fn setup_contract(env: &Env) -> (Address, EscrowClient, Address, Address) {
    let contract_id = env.register(Escrow, ());
    let client = EscrowClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let fee_collector = Address::generate(env);
    client.initialize(&admin, &fee_collector, &0_u32);
    (contract_id, client, admin, fee_collector)
}

pub fn mint_token(env: &Env, token: &Address, to: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token).mint(to, &amount);
}

pub fn advance_time(env: &Env, seconds: u64) {
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + seconds);
}

pub fn create_funded_escrow(
    env: &Env,
    client: &EscrowClient,
    seller: &Address,
    buyer: &Address,
    resolver: &Address,
    token: &Address,
    amount: i128,
    fee_bps: u32,
    shipping_window: u64,
) -> u64 {
    mint_token(env, token, buyer, amount);
    let id = client.create_escrow(
        &single_payee(env, seller),
        &None::<Address>,
        resolver,
        token,
        &amount,
        &fee_bps,
        &0_u32,
        &shipping_window,
    );
    client.fund_escrow(&id, buyer);
    id
}

pub fn create_funded_milestone_escrow(
    env: &Env,
    client: &EscrowClient,
    seller: &Address,
    buyer: &Address,
    resolver: &Address,
    token: &Address,
    milestone_amounts: &soroban_sdk::Vec<i128>,
    fee_bps: u32,
    shipping_window: u64,
) -> u64 {
    let total: i128 = milestone_amounts.iter().sum();
    mint_token(env, token, buyer, total);
    let id = client.create_milestone_escrow(
        seller,
        &None::<Address>,
        resolver,
        token,
        milestone_amounts,
        &fee_bps,
        &shipping_window,
    );
    client.fund_escrow(&id, buyer);
    id
}

/// Wraps a single address into a one-entry, 100%-bps payees vec, so existing
/// tests written for the old single-seller create_escrow signature don't
/// need to be rewritten field-by-field for the new multi-payee model.
pub fn single_payee(env: &Env, address: &Address) -> Vec<Payee> {
    let mut payees = Vec::new(env);
    payees.push_back(Payee {
        address: address.clone(),
        bps: 10_000,
    });
    payees
}