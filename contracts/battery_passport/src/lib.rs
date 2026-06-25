#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};

pub const STATUS_ACTIVE: u32 = 1;
pub const STATUS_VERIFIED: u32 = 2;
pub const STATUS_UNDER_REVIEW: u32 = 3;
pub const STATUS_RECALLED: u32 = 4;
pub const STATUS_RECYCLED: u32 = 5;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformConfig {
    pub admin: Address,
    pub initialized: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatteryPassport {
    pub serial: String,
    pub chemistry: String,
    pub capacity_wh: u32,
    pub carbon_kg: u32,
    pub batch_id: String,
    pub manufacturer: Address,
    pub owner: Address,
    pub status: u32,
    pub recycled: bool,
    pub verified: bool,
    pub recall_flag: bool,
    pub inspections: u32,
    pub risk_score: u32,
    pub recycler: Option<Address>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditRecord {
    pub serial: String,
    pub actor: Address,
    pub action: String,
    pub note: String,
    pub score: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryStats {
    pub total_passports: u32,
    pub active_passports: u32,
    pub recycled_passports: u32,
    pub verified_passports: u32,
    pub recalled_passports: u32,
    pub total_inspections: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Stats,
    Passport(String),
    AuditCount(String),
    Audit(String, u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PassportError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    SerialAlreadyExists = 3,
    PassportNotFound = 4,
    AlreadyRecycled = 5,
    Unauthorized = 6,
    InvalidScore = 7,
}

#[contractevent(topics = ["battery_passport", "initialized"], data_format = "map")]
pub struct RegistryInitializedEvent {
    pub admin: Address,
}

#[contractevent(topics = ["battery_passport", "created"], data_format = "map")]
pub struct PassportCreatedEvent {
    pub serial: String,
    pub manufacturer: Address,
}

#[contractevent(
    topics = ["battery_passport", "ownership_transferred"],
    data_format = "map"
)]
pub struct OwnershipTransferredEvent {
    pub serial: String,
    pub new_owner: Address,
}

#[contractevent(topics = ["battery_passport", "inspection_added"], data_format = "map")]
pub struct InspectionAddedEvent {
    pub serial: String,
    pub inspector: Address,
    pub score: u32,
}

#[contractevent(topics = ["battery_passport", "verified"], data_format = "map")]
pub struct PassportVerifiedEvent {
    pub serial: String,
    pub verifier: Address,
}

#[contractevent(topics = ["battery_passport", "recall_flagged"], data_format = "map")]
pub struct RecallFlaggedEvent {
    pub serial: String,
    pub issuer: Address,
}

#[contractevent(topics = ["battery_passport", "recycled"], data_format = "map")]
pub struct BatteryRecycledEvent {
    pub serial: String,
    pub recycler: Address,
}

#[contract]
pub struct BatteryPassportContract;

#[contractimpl]
impl BatteryPassportContract {
    pub fn initialize(env: Env, admin: Address) -> Result<PlatformConfig, PassportError> {
        admin.require_auth();

        if env.storage().persistent().has(&DataKey::Config) {
            return Err(PassportError::AlreadyInitialized);
        }

        let config = PlatformConfig {
            admin: admin.clone(),
            initialized: true,
        };

        env.storage().persistent().set(&DataKey::Config, &config);
        env.storage()
            .persistent()
            .set(&DataKey::Stats, &empty_stats());

        RegistryInitializedEvent {
            admin: admin.clone(),
        }
        .publish(&env);

        Ok(config)
    }

    pub fn create_passport(
        env: Env,
        manufacturer: Address,
        serial: String,
        chemistry: String,
        capacity_wh: u32,
        carbon_kg: u32,
        batch_id: String,
    ) -> Result<BatteryPassport, PassportError> {
        manufacturer.require_auth();

        let key = DataKey::Passport(serial.clone());
        if env.storage().persistent().has(&key) {
            return Err(PassportError::SerialAlreadyExists);
        }

        let timestamp = env.ledger().timestamp();

        let passport = BatteryPassport {
            serial: serial.clone(),
            chemistry,
            capacity_wh,
            carbon_kg,
            batch_id,
            manufacturer: manufacturer.clone(),
            owner: manufacturer.clone(),
            status: STATUS_ACTIVE,
            recycled: false,
            verified: false,
            recall_flag: false,
            inspections: 0,
            risk_score: 0,
            recycler: None,
            created_at: timestamp,
            updated_at: timestamp,
        };

        env.storage().persistent().set(&key, &passport);

        let mut stats = read_stats(&env);
        stats.total_passports += 1;
        stats.active_passports += 1;
        write_stats(&env, &stats);

        write_audit(
            &env,
            serial.clone(),
            manufacturer.clone(),
            String::from_str(&env, "create_passport"),
            String::from_str(&env, "Battery passport created"),
            0,
        );

        PassportCreatedEvent {
            serial: serial.clone(),
            manufacturer: manufacturer.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn transfer_owner(
        env: Env,
        current_owner: Address,
        serial: String,
        new_owner: Address,
    ) -> Result<BatteryPassport, PassportError> {
        current_owner.require_auth();

        let key = DataKey::Passport(serial.clone());
        let mut passport = read_passport(&env, &serial)?;

        if passport.owner != current_owner {
            return Err(PassportError::Unauthorized);
        }

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        passport.owner = new_owner.clone();
        passport.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&key, &passport);

        write_audit(
            &env,
            serial.clone(),
            current_owner.clone(),
            String::from_str(&env, "transfer_owner"),
            String::from_str(&env, "Ownership transferred"),
            0,
        );

        OwnershipTransferredEvent {
            serial: serial.clone(),
            new_owner: new_owner.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn add_inspection(
        env: Env,
        inspector: Address,
        serial: String,
        score: u32,
        note: String,
    ) -> Result<BatteryPassport, PassportError> {
        inspector.require_auth();

        if score > 100 {
            return Err(PassportError::InvalidScore);
        }

        let key = DataKey::Passport(serial.clone());
        let mut passport = read_passport(&env, &serial)?;

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        passport.inspections += 1;
        passport.risk_score = score;
        passport.updated_at = env.ledger().timestamp();

        if score < 60 {
            passport.status = STATUS_UNDER_REVIEW;
        }

        env.storage().persistent().set(&key, &passport);

        let mut stats = read_stats(&env);
        stats.total_inspections += 1;
        write_stats(&env, &stats);

        write_audit(
            &env,
            serial.clone(),
            inspector.clone(),
            String::from_str(&env, "add_inspection"),
            note,
            score,
        );

        InspectionAddedEvent {
            serial: serial.clone(),
            inspector: inspector.clone(),
            score,
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn verify_passport(
        env: Env,
        verifier: Address,
        serial: String,
    ) -> Result<BatteryPassport, PassportError> {
        verifier.require_auth();

        let key = DataKey::Passport(serial.clone());
        let mut passport = read_passport(&env, &serial)?;

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        let was_verified = passport.verified;

        passport.verified = true;
        passport.status = STATUS_VERIFIED;
        passport.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&key, &passport);

        if !was_verified {
            let mut stats = read_stats(&env);
            stats.verified_passports += 1;
            write_stats(&env, &stats);
        }

        write_audit(
            &env,
            serial.clone(),
            verifier.clone(),
            String::from_str(&env, "verify_passport"),
            String::from_str(&env, "Passport verified"),
            0,
        );

        PassportVerifiedEvent {
            serial: serial.clone(),
            verifier: verifier.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn flag_recall(
        env: Env,
        issuer: Address,
        serial: String,
        reason: String,
    ) -> Result<BatteryPassport, PassportError> {
        issuer.require_auth();

        let key = DataKey::Passport(serial.clone());
        let mut passport = read_passport(&env, &serial)?;

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        let was_recalled = passport.recall_flag;

        passport.recall_flag = true;
        passport.status = STATUS_RECALLED;
        passport.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&key, &passport);

        if !was_recalled {
            let mut stats = read_stats(&env);
            stats.recalled_passports += 1;
            write_stats(&env, &stats);
        }

        write_audit(
            &env,
            serial.clone(),
            issuer.clone(),
            String::from_str(&env, "flag_recall"),
            reason,
            0,
        );

        RecallFlaggedEvent {
            serial: serial.clone(),
            issuer: issuer.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn mark_recycled(
        env: Env,
        owner: Address,
        serial: String,
        recycler: Address,
    ) -> Result<BatteryPassport, PassportError> {
        owner.require_auth();

        let key = DataKey::Passport(serial.clone());
        let mut passport = read_passport(&env, &serial)?;

        if passport.owner != owner {
            return Err(PassportError::Unauthorized);
        }

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        passport.recycled = true;
        passport.status = STATUS_RECYCLED;
        passport.recycler = Some(recycler.clone());
        passport.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&key, &passport);

        let mut stats = read_stats(&env);
        stats.recycled_passports += 1;
        if stats.active_passports > 0 {
            stats.active_passports -= 1;
        }
        write_stats(&env, &stats);

        write_audit(
            &env,
            serial.clone(),
            owner.clone(),
            String::from_str(&env, "mark_recycled"),
            String::from_str(&env, "Battery recycled"),
            0,
        );

        BatteryRecycledEvent {
            serial: serial.clone(),
            recycler: recycler.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn get_passport(env: Env, serial: String) -> Result<BatteryPassport, PassportError> {
        read_passport(&env, &serial)
    }

    pub fn get_stats(env: Env) -> RegistryStats {
        read_stats(&env)
    }

    pub fn get_audit_count(env: Env, serial: String) -> u32 {
        read_audit_count(&env, &serial)
    }

    pub fn get_audit(env: Env, serial: String, index: u32) -> Result<AuditRecord, PassportError> {
        let key = DataKey::Audit(serial, index);
        match env.storage().persistent().get(&key) {
            Some(record) => Ok(record),
            None => Err(PassportError::PassportNotFound),
        }
    }

    pub fn get_config(env: Env) -> Result<PlatformConfig, PassportError> {
        match env.storage().persistent().get(&DataKey::Config) {
            Some(config) => Ok(config),
            None => Err(PassportError::NotInitialized),
        }
    }
}

fn empty_stats() -> RegistryStats {
    RegistryStats {
        total_passports: 0,
        active_passports: 0,
        recycled_passports: 0,
        verified_passports: 0,
        recalled_passports: 0,
        total_inspections: 0,
    }
}

fn read_stats(env: &Env) -> RegistryStats {
    env.storage()
        .persistent()
        .get(&DataKey::Stats)
        .unwrap_or(empty_stats())
}

fn write_stats(env: &Env, stats: &RegistryStats) {
    env.storage().persistent().set(&DataKey::Stats, stats);
}

fn read_passport(env: &Env, serial: &String) -> Result<BatteryPassport, PassportError> {
    let key = DataKey::Passport(serial.clone());
    match env.storage().persistent().get(&key) {
        Some(passport) => Ok(passport),
        None => Err(PassportError::PassportNotFound),
    }
}

fn read_audit_count(env: &Env, serial: &String) -> u32 {
    let key = DataKey::AuditCount(serial.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn write_audit(
    env: &Env,
    serial: String,
    actor: Address,
    action: String,
    note: String,
    score: u32,
) {
    let index = read_audit_count(env, &serial);
    let record = AuditRecord {
        serial: serial.clone(),
        actor,
        action,
        note,
        score,
        timestamp: env.ledger().timestamp(),
    };

    env.storage()
        .persistent()
        .set(&DataKey::Audit(serial.clone(), index), &record);
    env.storage()
        .persistent()
        .set(&DataKey::AuditCount(serial), &(index + 1));
}

#[cfg(test)]
mod test;
