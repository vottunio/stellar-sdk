# Wirex – Vottun Stellar SDK

## SCF #41 Grant — $129.6K — Build Track

**Status:** Information Collection
**Category:** Developer Tooling
**Blockchain:** Stellar (only)

---

## Overview

Modular, ecosystem-reusable SDK for the Stellar blockchain. Simplifies development of payment-enabled applications and accelerates real-world adoption of Stellar.

---

## Team

### Vottun (Development Partner)
- **Luis Carbajo** — Founder & CEO. Blockchain infrastructure, digital identity, tokenization, enterprise Web3.
- **Marta Vallès** — Co-founder. Product strategy, ecosystem development, partner coordination.
- **Sergi Martinez** — Development.
- Senior dev team: Blockchain SDK/API design, Stellar & Soroban integrations, secure wallet/tx infrastructure.

### Wirex (Product Owner)
- **Pavel Matveev** — Co-founder & Executive Chairman.
- **Dmitry Lazarichev** — Co-founder.
- Regulated payments, crypto-to-fiat, compliance-first design, large-scale fintech platforms.

**Team Size:** 4

---

## Traction Evidence

- Wirex: founded 2014, 7M+ users, $20B+ tx volume, 130+ countries, 20+ awards.
- Principal member of Visa and Mastercard — 80M+ merchants, 200+ countries.
- 18 active BaaS clients: LOBSTR, Simple.App, Best Wallet, Folks Finance, Cardano Foundation, FC Barcelona, FreedX.
- Live dual-stablecoin settlement on Stellar (USDC + EURC) — real-time card payments with on-chain transparency.
- Onboarding 2-5 new enterprise clients/month.
- Projected: 10M+ cards issued, $60B+ annual card volume within 3 years.

---

## SDK Modules (7)

### 1. Wallet Management Module
- Stellar account creation and querying via Horizon APIs.
- Balance retrieval: XLM, USDC, EURC.
- Trustline management.
- Non-custodial key handling (client-side signing).

### 2. Transaction Lifecycle Module
- Transaction construction and client-side signing.
- Fee handling and submission via Horizon.
- Transaction status and lifecycle tracking.

### 3. Smart Contract Interaction Module (Soroban)
- High-level Soroban contract invocation helpers.
- Parameter encoding and decoding.
- Consistent error normalization.

### 4. API Client Module
- Unified client for Stellar network APIs and external services.
- Standardized request/response and error handling models.

### 5. WebSocket & Streaming Module
- Real-time account and transaction event subscriptions via Horizon streaming.
- Network activity streaming.

### 6. Configuration Module
- Testnet / mainnet environment switching.
- Network and endpoint configuration.

### 7. Reference Integration: Wirex Payments
- Demonstration of regulated payment flows connected to Stellar.
- On-chain settlement using XLM, USDC, EURC.
- Non-custodial integration pattern as reusable ecosystem reference.

---

## Delivery Roadmap — 3 Tranches, 16 Weeks

### Tranche 1 — MVP ($28,800) — End of Week 5

**Deliverables:**
- **D1.1 – Wallet Management Module (Stellar)**
  - Account creation, querying, balances (XLM, USDC, EURC), trustlines, non-custodial key handling.
- **D1.2 – Transaction Lifecycle Module**
  - Construction, signing, fee handling, submission via Horizon, status tracking.
- **D1.3 – Configuration Module**
  - Testnet/mainnet switching, network/endpoint config.

**Acceptance Criteria:**
- Successful Stellar testnet transactions executed using the SDK.
- Unit tests covering wallet and transaction flows.
- Developer documentation for all implemented modules.

---

### Tranche 2 — Testnet ($43,200) — End of Week 11

**Deliverables:**
- **D2.1 – Smart Contract Interaction Module (Soroban)**
  - Contract invocation helpers, parameter encoding/decoding, error normalization.
- **D2.2 – API Client Module**
  - Unified client, standardized response/error handling.
- **D2.3 – WebSocket & Streaming Module**
  - Real-time event subscriptions, network streaming.
- **D2.4 – Wirex Reference Integration (Testnet)**
  - Regulated payment flows on Stellar, on-chain settlement (XLM, USDC, EURC), reusable non-custodial pattern.

**Acceptance Criteria:**
- End-to-end testnet payment flows executed via the SDK.
- Live streaming events demonstrated.
- Reference integration reproducible following published documentation.

---

### Tranche 3 — Mainnet ($57,600) — End of Week 16

**Deliverables:**
- **D3.1 – Mainnet-Ready SDK Release**
  - Full mainnet support for all modules. Horizon, Soroban, Stellar assets compatibility.
- **D3.2 – Production Documentation & Examples**
  - Developer usage guides, example integrations, reference flows, final API docs.
- **D3.3 – Professional User Testing (SCF Requirement)**
  - External developer user testing, feedback incorporation, final fixes.

**Acceptance Criteria:**
- Successful mainnet transactions executed using the SDK.
- Tagged mainnet SDK release published.
- Professional user testing completed and documented.

---

## Archived Documents

Previous proposal iterations are in [docs/old/](docs/old/):
- `proposal-original-evm.md` — Initial generic EVM-centric proposal.
- `proposal-stellar-abstract.md` — Multi-blockchain abstraction approach (v2.0).
- `proposal-stellar-only.md` — Stellar-focused proposal (precursor to grant submission).
