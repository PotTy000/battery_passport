use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_test() -> (
    Env,
    BatteryPassportContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(BatteryPassportContract, ());
    let client = BatteryPassportContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let recycler = Address::generate(&env);

    (env, client, owner, new_owner, recycler)
}

#[test]
fn create_and_read_passport() {
    let (env, client, owner, _new_owner, _recycler) = setup_test();

    let serial = String::from_str(&env, "BATTERY-001");
    let chemistry = String::from_str(&env, "LFP");
    let manufacturer = String::from_str(&env, "VinFast Battery Lab");

    let passport = client.create_passport(
        &owner,
        &serial,
        &chemistry,
        &75000u32,
        &420u32,
        &manufacturer,
    );

    assert_eq!(passport.serial, serial);
    assert_eq!(passport.chemistry, chemistry);
    assert_eq!(passport.capacity_wh, 75000u32);
    assert_eq!(passport.carbon_kg, 420u32);
    assert_eq!(passport.manufacturer, manufacturer);
    assert_eq!(passport.owner, owner);
    assert_eq!(passport.recycled, false);

    let saved_passport = client.get_passport(&serial);

    assert_eq!(saved_passport.serial, serial);
    assert_eq!(saved_passport.owner, owner);
}

#[test]
fn cannot_create_duplicate_serial() {
    let (env, client, owner, _new_owner, _recycler) = setup_test();

    let serial = String::from_str(&env, "BATTERY-002");
    let chemistry = String::from_str(&env, "NMC");
    let manufacturer = String::from_str(&env, "Samsung SDI");

    client.create_passport(
        &owner,
        &serial,
        &chemistry,
        &50000u32,
        &300u32,
        &manufacturer,
    );

    let result = client.try_create_passport(
        &owner,
        &serial,
        &chemistry,
        &50000u32,
        &300u32,
        &manufacturer,
    );

    assert_eq!(result, Err(Ok(PassportError::SerialAlreadyExists)));
}

#[test]
fn transfer_owner_successfully() {
    let (env, client, owner, new_owner, _recycler) = setup_test();

    let serial = String::from_str(&env, "BATTERY-003");
    let chemistry = String::from_str(&env, "Li-ion");
    let manufacturer = String::from_str(&env, "Panasonic Energy");

    client.create_passport(
        &owner,
        &serial,
        &chemistry,
        &65000u32,
        &380u32,
        &manufacturer,
    );

    let updated_passport = client.transfer_owner(&owner, &serial, &new_owner);

    assert_eq!(updated_passport.owner, new_owner);
    assert_eq!(updated_passport.recycled, false);
}

#[test]
fn mark_battery_as_recycled() {
    let (env, client, owner, _new_owner, recycler) = setup_test();

    let serial = String::from_str(&env, "BATTERY-004");
    let chemistry = String::from_str(&env, "Solid State");
    let manufacturer = String::from_str(&env, "Toyota Battery Division");

    client.create_passport(
        &owner,
        &serial,
        &chemistry,
        &90000u32,
        &500u32,
        &manufacturer,
    );

    let recycled_passport = client.mark_recycled(&owner, &serial, &recycler);

    assert_eq!(recycled_passport.recycled, true);
    assert_eq!(recycled_passport.recycler, Some(recycler));
}

#[test]
fn cannot_recycle_twice() {
    let (env, client, owner, _new_owner, recycler) = setup_test();

    let serial = String::from_str(&env, "BATTERY-005");
    let chemistry = String::from_str(&env, "LFP");
    let manufacturer = String::from_str(&env, "CATL");

    client.create_passport(
        &owner,
        &serial,
        &chemistry,
        &70000u32,
        &410u32,
        &manufacturer,
    );

    client.mark_recycled(&owner, &serial, &recycler);

    let result = client.try_mark_recycled(&owner, &serial, &recycler);

    assert_eq!(result, Err(Ok(PassportError::AlreadyRecycled)));
}

#[test]
fn passport_not_found_error() {
    let (env, client, _owner, _new_owner, _recycler) = setup_test();

    let missing_serial = String::from_str(&env, "UNKNOWN-BATTERY");

    let result = client.try_get_passport(&missing_serial);

    assert_eq!(result, Err(Ok(PassportError::PassportNotFound)));
}