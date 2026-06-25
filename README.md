# Battery Passport Level 4

Battery Passport is a production-style Stellar and Soroban MVP for tracking battery lifecycle data across manufacturers, owners, inspectors, regulators, and recyclers.

This project upgrades the original Battery Passport Registry into a product-style codebase with a custom Soroban contract, React frontend, backend service, CI validation, and deployment configuration.

## Product Problem

Battery lifecycle data is often fragmented across different parties. Manufacturers, owners, inspectors, and recyclers may each hold separate records. This makes it difficult to verify battery origin, ownership history, inspection status, recall risk, and recycling completion.

## Solution

Battery Passport provides an on-chain registry where each battery has a verifiable passport on Stellar Testnet.

Users can create a battery passport, transfer ownership, add inspection records, verify passport data, flag recall risk, mark a battery as recycled, and view registry statistics.

## Why Stellar

Stellar is a good fit because the product needs fast, low-cost, and verifiable state updates. Soroban smart contracts allow the app to store battery lifecycle data, ownership transitions, audit records, and recycling status on testnet.

## Tech Stack

- Stellar Testnet
- Soroban smart contracts
- Rust
- React
- Vite
- TypeScript
- Express backend
- GitHub Actions
- Vercel configuration
- Railway configuration

## Repository Structure

- contracts/battery_passport/src/lib.rs
- contracts/battery_passport/src/test.rs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/services/contract.ts
- frontend/src/services/api.ts
- frontend/src/services/analytics.ts
- server/index.ts
- server/services/contractService.ts
- scripts/deploy-and-save.ps1
- scripts/verify-level4.ps1
- docs/ARCHITECTURE.md
- docs/QUALITY_AND_DEPLOYMENT.md
- .github/workflows/ci.yml
- vercel.json
- railway.toml
- Procfile

## Smart Contract

The smart contract is located at contracts/battery_passport/src/lib.rs.

Main contract functions:

- initialize
- create_passport
- transfer_owner
- add_inspection
- verify_passport
- flag_recall
- mark_recycled
- get_passport
- get_stats
- get_audit_count
- get_audit
- get_config

Custom contract structures:

- PlatformConfig
- BatteryPassport
- AuditRecord
- RegistryStats
- DataKey
- PassportError

## Frontend

The frontend is a responsive dashboard for wallet connection, contract actions, transaction status, activity tracking, product metrics, and feedback collection.

Important frontend files:

- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/services/contract.ts
- frontend/src/services/api.ts
- frontend/src/services/analytics.ts

## Backend

The backend provides health checks, contract runtime configuration, function coverage, wallet interaction tracking, and feedback collection.

Important backend files:

- server/index.ts
- server/services/contractService.ts

## CI and Deployment

GitHub Actions workflow is located at .github/workflows/ci.yml.

The workflow validates Rust formatting, smart contract tests, Soroban contract build, frontend type-check, frontend build, backend type-check, backend build, and deployment config files.

Deployment files:

- vercel.json
- railway.toml
- Procfile
- scripts/deploy-and-save.ps1

## Local Setup

Clone repository:

git clone https://github.com/PotTy000/battery_passport.git
cd battery_passport

Install Rust target:

rustup target add wasm32v1-none

Test and build smart contract:

cargo fmt
cargo test --workspace
stellar contract build

Run frontend:

cd frontend
npm install
npm run dev

Run backend in another terminal:

cd server
npm install
npm run dev

## Full Local Verification

From the project root:

.\scripts\verify-level4.ps1

## Smart Contract Deployment

From the project root:

.\scripts\deploy-and-save.ps1

The deploy script formats the contract, runs tests, builds the WASM, deploys to Stellar Testnet, saves the contract ID, and updates the frontend contract config.

## Documentation

- docs/ARCHITECTURE.md
- docs/QUALITY_AND_DEPLOYMENT.md
