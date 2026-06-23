#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatteryPassport {
    pub serial: String,
    pub chemistry: String,
    pub capacity_wh: u32,
    pub carbon_kg: u32,
    pub manufacturer: String,
    pub owner: Address,
    pub recycled: bool,
    pub recycler: Option<Address>,
}

#[contracttype]
pub enum DataKey {
    Passport(String),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PassportError {
    SerialAlreadyExists = 1,
    PassportNotFound = 2,
    AlreadyRecycled = 3,
    Unauthorized = 4,
}

#[contractevent(topics = ["battery_passport", "created"], data_format = "single-value")]
pub struct PassportCreatedEvent {
    pub serial: String,
}

#[contractevent(topics = ["battery_passport", "ownership_transferred"], data_format = "single-value")]
pub struct OwnershipTransferredEvent {
    pub serial: String,
}

#[contractevent(topics = ["battery_passport", "recycled"], data_format = "single-value")]
pub struct BatteryRecycledEvent {
    pub serial: String,
}

#[contract]
pub struct BatteryPassportContract;

#[contractimpl]
impl BatteryPassportContract {
    pub fn create_passport(
        env: Env,
        owner: Address,
        serial: String,
        chemistry: String,
        capacity_wh: u32,
        carbon_kg: u32,
        manufacturer: String,
    ) -> Result<BatteryPassport, PassportError> {
        owner.require_auth();

        let key = DataKey::Passport(serial.clone());

        if env.storage().persistent().has(&key) {
            return Err(PassportError::SerialAlreadyExists);
        }

        let passport = BatteryPassport {
            serial: serial.clone(),
            chemistry,
            capacity_wh,
            carbon_kg,
            manufacturer,
            owner: owner.clone(),
            recycled: false,
            recycler: None,
        };

        env.storage().persistent().set(&key, &passport);

        PassportCreatedEvent {
            serial: serial.clone(),
        }
        .publish(&env);

        Ok(passport)
    }

    pub fn get_passport(env: Env, serial: String) -> Result<BatteryPassport, PassportError> {
        let key = DataKey::Passport(serial);

        let passport: Option<BatteryPassport> = env.storage().persistent().get(&key);

        match passport {
            Some(passport) => Ok(passport),
            None => Err(PassportError::PassportNotFound),
        }
    }

    pub fn transfer_owner(
        env: Env,
        current_owner: Address,
        serial: String,
        new_owner: Address,
    ) -> Result<BatteryPassport, PassportError> {
        current_owner.require_auth();

        let key = DataKey::Passport(serial.clone());

        let mut passport: BatteryPassport = match env.storage().persistent().get(&key) {
            Some(passport) => passport,
            None => return Err(PassportError::PassportNotFound),
        };

        if passport.owner != current_owner {
            return Err(PassportError::Unauthorized);
        }

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        passport.owner = new_owner;

        env.storage().persistent().set(&key, &passport);

        OwnershipTransferredEvent {
            serial: serial.clone(),
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

        let mut passport: BatteryPassport = match env.storage().persistent().get(&key) {
            Some(passport) => passport,
            None => return Err(PassportError::PassportNotFound),
        };

        if passport.owner != owner {
            return Err(PassportError::Unauthorized);
        }

        if passport.recycled {
            return Err(PassportError::AlreadyRecycled);
        }

        passport.recycled = true;
        passport.recycler = Some(recycler);

        env.storage().persistent().set(&key, &passport);

        BatteryRecycledEvent {
            serial: serial.clone(),
        }
        .publish(&env);

        Ok(passport)
    }
}

#[cfg(test)]
mod test;