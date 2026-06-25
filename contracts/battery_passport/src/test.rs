use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_test() -> (
    Env,
    BatteryPassportContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(BatteryPassportContract, ());
    let client = BatteryPassportContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let inspector = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.initialize(&admin);

    (
        env,
        client,
        admin,
        manufacturer,
        new_owner,
        inspector,
        recycler,
    )
}

fn create_sample_passport(
    env: &Env,
    client: &BatteryPassportContractClient,
    manufacturer: &Address,
    serial: &String,
) -> BatteryPassport {
    client.create_passport(
        manufacturer,
        serial,
        &String::from_str(env, "LFP"),
        &75000u32,
        &420u32,
        &String::from_str(env, "BATCH-Q3-2026"),
    )
}

#[test]
fn initialize_registry_once() {
    let (env, client, admin, _manufacturer, _new_owner, _inspector, _recycler) = setup_test();

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.initialized, true);

    let second_admin = Address::generate(&env);
    let result = client.try_initialize(&second_admin);
    assert_eq!(result, Err(Ok(PassportError::AlreadyInitialized)));
}

#[test]
fn create_and_read_production_passport() {
    let (env, client, _admin, manufacturer, _new_owner, _inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-001");

    let passport = create_sample_passport(&env, &client, &manufacturer, &serial);

    assert_eq!(passport.serial, serial);
    assert_eq!(passport.manufacturer, manufacturer);
    assert_eq!(passport.owner, manufacturer);
    assert_eq!(passport.status, STATUS_ACTIVE);
    assert_eq!(passport.recycled, false);
    assert_eq!(passport.verified, false);
    assert_eq!(passport.recall_flag, false);

    let saved_passport = client.get_passport(&serial);
    assert_eq!(saved_passport.serial, serial);
    assert_eq!(saved_passport.capacity_wh, 75000u32);

    let stats = client.get_stats();
    assert_eq!(stats.total_passports, 1);
    assert_eq!(stats.active_passports, 1);
}

#[test]
fn cannot_create_duplicate_serial() {
    let (env, client, _admin, manufacturer, _new_owner, _inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-002");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let result = client.try_create_passport(
        &manufacturer,
        &serial,
        &String::from_str(&env, "LFP"),
        &75000u32,
        &420u32,
        &String::from_str(&env, "BATCH-Q3-2026"),
    );

    assert_eq!(result, Err(Ok(PassportError::SerialAlreadyExists)));
}

#[test]
fn transfer_owner_successfully() {
    let (env, client, _admin, manufacturer, new_owner, _inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-003");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let updated_passport = client.transfer_owner(&manufacturer, &serial, &new_owner);
    assert_eq!(updated_passport.owner, new_owner);
    assert_eq!(updated_passport.recycled, false);

    let audit_count = client.get_audit_count(&serial);
    assert_eq!(audit_count, 2);
}

#[test]
fn unauthorized_transfer_is_rejected() {
    let (env, client, _admin, manufacturer, new_owner, inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-004");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let result = client.try_transfer_owner(&inspector, &serial, &new_owner);
    assert_eq!(result, Err(Ok(PassportError::Unauthorized)));
}

#[test]
fn add_inspection_and_verify_passport() {
    let (env, client, _admin, manufacturer, _new_owner, inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-005");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let inspected = client.add_inspection(
        &inspector,
        &serial,
        &92u32,
        &String::from_str(&env, "Passed safety and origin audit"),
    );

    assert_eq!(inspected.inspections, 1);
    assert_eq!(inspected.risk_score, 92);

    let verified = client.verify_passport(&inspector, &serial);

    assert_eq!(verified.verified, true);
    assert_eq!(verified.status, STATUS_VERIFIED);

    let stats = client.get_stats();
    assert_eq!(stats.total_inspections, 1);
    assert_eq!(stats.verified_passports, 1);

    let audit_count = client.get_audit_count(&serial);
    assert_eq!(audit_count, 3);

    let audit = client.get_audit(&serial, &1u32);
    assert_eq!(audit.score, 92);
}

#[test]
fn invalid_inspection_score_is_rejected() {
    let (env, client, _admin, manufacturer, _new_owner, inspector, _recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-006");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let result = client.try_add_inspection(
        &inspector,
        &serial,
        &101u32,
        &String::from_str(&env, "Invalid score"),
    );

    assert_eq!(result, Err(Ok(PassportError::InvalidScore)));
}

#[test]
fn flag_recall_and_recycle_battery() {
    let (env, client, _admin, manufacturer, _new_owner, inspector, recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-007");

    create_sample_passport(&env, &client, &manufacturer, &serial);

    let recalled = client.flag_recall(
        &inspector,
        &serial,
        &String::from_str(&env, "Thermal anomaly detected"),
    );

    assert_eq!(recalled.recall_flag, true);
    assert_eq!(recalled.status, STATUS_RECALLED);

    let recycled = client.mark_recycled(&manufacturer, &serial, &recycler);

    assert_eq!(recycled.recycled, true);
    assert_eq!(recycled.status, STATUS_RECYCLED);
    assert_eq!(recycled.recycler, Some(recycler));

    let stats = client.get_stats();
    assert_eq!(stats.total_passports, 1);
    assert_eq!(stats.active_passports, 0);
    assert_eq!(stats.recalled_passports, 1);
    assert_eq!(stats.recycled_passports, 1);
}

#[test]
fn cannot_recycle_twice() {
    let (env, client, _admin, manufacturer, _new_owner, _inspector, recycler) = setup_test();
    let serial = String::from_str(&env, "BATTERY-L4-008");

    create_sample_passport(&env, &client, &manufacturer, &serial);
    client.mark_recycled(&manufacturer, &serial, &recycler);

    let result = client.try_mark_recycled(&manufacturer, &serial, &recycler);
    assert_eq!(result, Err(Ok(PassportError::AlreadyRecycled)));
}

#[test]
fn passport_not_found_error() {
    let (env, client, _admin, _manufacturer, _new_owner, _inspector, _recycler) = setup_test();
    let missing_serial = String::from_str(&env, "UNKNOWN-BATTERY");

    let result = client.try_get_passport(&missing_serial);
    assert_eq!(result, Err(Ok(PassportError::PassportNotFound)));
}
