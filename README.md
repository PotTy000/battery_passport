# Battery Passport Registry

Battery Passport Registry is a Stellar Level 3 dApp built with Soroban smart contracts and a React frontend.

The project creates tamper-proof digital passports for EV and consumer-electronics batteries. Each battery passport stores important lifecycle data such as serial number, chemistry, capacity, embedded carbon footprint, manufacturer, current owner, and recycling status.

This project demonstrates a production-style Stellar dApp architecture with smart contract deployment, wallet-connected frontend interaction, transaction status tracking, contract error handling, automated CI checks, and clear documentation for local development and review.

---

## Project Overview

### Problem

Battery supply chains are difficult to audit. Manufacturers, second-life buyers, recyclers, regulators, and consumers need a reliable way to verify battery origin, metadata, ownership, and recycling status.

Without a shared digital registry, battery lifecycle data can be fragmented across spreadsheets, private databases, or paper documents. This makes it harder to prove where a battery came from, who owns it, whether it has been recycled, and whether its lifecycle claims are trustworthy.

### Solution

Battery Passport Registry stores battery lifecycle data on Stellar Testnet through a Soroban smart contract.

A user can connect a Stellar wallet, create a battery passport, read passport data, transfer ownership, and mark a battery as recycled. Contract interactions produce transaction hashes that can be verified on Stellar Expert.

### Why Stellar

Stellar is a strong fit for this project because it provides low-cost, fast, and public infrastructure for real-world financial and asset workflows.

Battery passports are a real-world asset traceability use case. Stellar can support this by making ownership records, lifecycle events, and audit trails easier to verify.

---

## Core Features

- Create a new battery passport
- Read battery passport data by serial number
- Transfer battery ownership to another Stellar address
- Mark a battery as recycled
- Store lifecycle data through a deployed Soroban smart contract
- Connect wallet from the frontend
- Display transaction status: idle, pending, success, and failed
- Display contract call transaction hash
- Map contract errors into user-friendly frontend messages
- Verify contract interaction through Stellar Expert
- Run automated contract and frontend checks through GitHub Actions

---

## Level 3 Requirements Covered

| Level 3 Requirement | Status |
|---|---|
| Public GitHub repository | Included |
| Complete README documentation | Included |
| 10+ meaningful commits | In progress |
| Live demo link | To be added after frontend deployment |
| Contract deployment address | Included |
| Transaction hash for contract interaction | Included |
| CI/CD pipeline setup | Included through GitHub Actions |
| Smart contract deployment workflow | Included through deploy script |
| Mobile responsive frontend | Included in frontend design |
| Error handling and loading states | Included |
| Contract tests | Included |
| Frontend build check | Included through CI |
| Production-ready architecture practices | In progress |
| Documentation | Included |

---

## Tech Stack

### Smart Contract

- Rust
- Soroban SDK
- Stellar CLI
- Stellar Testnet

### Frontend

- React
- TypeScript
- Vite
- Stellar SDK
- Stellar Wallets Kit

### DevOps / CI

- GitHub Actions
- Cargo test
- Vite production build

---

## Contract Information

### Network

```txt
Stellar Testnet