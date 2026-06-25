# Battery Passport Architecture

## Product Summary
Battery Passport is a Stellar/Soroban supply-chain registry for battery lifecycle data.

## Architecture
User Wallet -> React Frontend -> Backend API -> Soroban RPC -> Stellar Testnet Smart Contract.

## Smart Contract Layer
The smart contract is located in contracts/battery_passport and implements custom battery lifecycle logic, persistent storage, events, custom errors, audit records, and registry statistics.

## Frontend Layer
The frontend is a Vite React dashboard with wallet connection, contract action mapping, transaction status, analytics, activity feed, and responsive UI.

## Backend Layer
The backend is an Express service for health checks, runtime contract config, function coverage, feedback collection, and wallet interaction tracking.

## CI/CD
GitHub Actions validates the smart contract, frontend, backend, and deployment configuration.

## Deployment
Frontend deployment is configured through vercel.json. Backend deployment is configured through railway.toml and Procfile. Smart contract deployment is automated through scripts/deploy-and-save.ps1.
