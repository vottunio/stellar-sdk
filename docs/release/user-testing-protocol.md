# Professional User Testing Protocol (Tranche 3.4.5)

SCF #41 grant acceptance criterion: *"Professional user testing completed and documented."* This document defines the protocol Vottun runs to satisfy that criterion.

---

## Goal

Validate that an experienced TypeScript/Stellar developer who has **never seen this SDK before** can:
1. Install and initialize the SDK in under 5 minutes
2. Complete a representative real-world task using only the published documentation
3. Surface defects that wouldn't be visible to the SDK authors

## Scope

- **In scope**: `@wirex/stellar-sdk@1.0.0` published to npm, the GitHub docs, the TypeDoc API reference
- **Out of scope**: testnet/mainnet infrastructure issues, third-party Stellar tooling

## Tester Profile

Each tester must have:
- Production experience with TypeScript (≥ 2 years)
- Familiarity with at least one blockchain (Stellar, Ethereum, Solana, Bitcoin) at the API level
- Used a wallet/payment SDK before (e.g. `@stellar/stellar-sdk`, `viem`, `@solana/web3.js`)

Recommended cohort size: **3 external developers**, drawn from outside Vottun and outside the SCF program. Compensate per the SCF user-testing budget if applicable.

---

## Test Sessions

Each tester completes one **90-minute moderated session** + one **24-hour async follow-up window** for deeper exploration.

### Pre-session (the day before)

The tester receives:
- A link to the published npm package
- A link to the GitHub repository (read-only) — `https://github.com/vottunio/stellar-sdk`
- The four test scenarios below
- A consent form covering recording, attribution, and IP handling

The tester is asked to come with:
- Their own dev machine, Node 18+ installed
- A code editor of their choice
- A blank scratch repo or directory

### Live session (90 min)

The tester screen-shares while a Vottun observer takes notes (the observer **does not** intervene unless the tester is fully blocked for > 5 min).

1. **Onboarding (15 min)** — install the SDK, read [getting-started](../getting-started.md), get to "Hello world" payment on testnet
2. **Scenario A (20 min)** — see below
3. **Scenario B (20 min)** — see below
4. **Scenario C (25 min)** — see below
5. **Debrief (10 min)** — open Q&A and structured feedback

### Async follow-up (24 hours)

Tester completes **Scenario D** in their own time, with the option to ask one async question via email/Slack.

---

## Scenarios

### Scenario A — Simple Payment (20 min)

> Build a CLI script that creates two wallets, funds Alice via Friendbot, then sends 5 XLM from Alice to Bob with a memo of "test-AB". Print the transaction hash and confirm Bob's balance updated.

**What we measure**:
- Time-to-first-payment from a blank file
- Number of times the tester opens the docs
- Whether they discover `sdk.transaction().addPayment(...)` vs writing it from scratch with raw Stellar SDK
- Any TypeScript errors they hit

### Scenario B — Trustline + Asset Payment (20 min)

> Bob wants to receive USDC. Open a USDC trustline for Bob (testnet issuer `GBBD47IF…`), then send 25 USDC from Alice to Bob. Note: Alice doesn't actually have USDC, so the test verifies error handling.

**What we measure**:
- Whether the tester finds `sdk.stellar.changeTrust(...)`
- How they react to the inevitable `op_underfunded` error (do they understand it from the typed error code?)
- Time to interpret the `ApiError` shape

### Scenario C — Wirex BaaS Integration (25 min)

> Replicate the [`wirex-stellar-settlement.ts`](../../examples/wirex-stellar-settlement.ts) example end-to-end in a new file, **without copying the example verbatim** — re-derive each step from the docs:
>
> 1. Authenticate against Wirex sandbox
> 2. Simulate a deposit instruction (any USD amount)
> 3. Anchor the instruction hash on Stellar via `manageData`
> 4. Send the matching XLM payment with the deposit ID in the memo
> 5. Verify the on-chain anchor matches a re-hash of the instruction

**What we measure**:
- Discoverability of `sdk.api.external(...)`
- Whether `manageData` is intuitive from the docs
- Whether the tester correctly subscribes to SSE **before** submitting (the key gotcha)
- Quality of the typed error surface when something goes wrong

### Scenario D — Async deep dive (24 hours)

The tester picks **one** of:

- **D-Soroban**: read the `decimals()` and `balance(...)` methods on the testnet XLM SAC contract (`CDLZFC3S…CYSC`), then invoke `transfer()` from one Friendbot-funded account to another. Document any auth-chain issues encountered.
- **D-Streaming**: write a server-style script that streams transactions for an account in real-time, persists the cursor to disk, and resumes after a forced kill. Demonstrate the resume actually works.
- **D-Performance**: run the SDK against 100 sequential payments and report latency percentiles. Compare against raw `@stellar/stellar-sdk` if possible.

---

## Feedback Capture

After each scenario, the observer fills out:

```
Scenario: __________
Outcome:  □ Completed  □ Partial  □ Blocked
Time to completion: ___ min
Docs opened (which pages, in order): _____________
Defects observed:
  1.
  2.
  3.
Suggestions:
  1.
  2.
Verbatim quote of the most interesting frustration:
  _____________________________________________
```

After all sessions, the SDK lead aggregates into:

- **Critical defects** (block 1.0.0 release)
- **Major defects** (fix before 1.1.0)
- **Polish** (track as issues, fix opportunistically)
- **Documentation gaps** (fix immediately — doc-only changes don't bump the version)

---

## Acceptance for SCF

The user testing is considered complete when:
- ≥ 3 testers have completed sessions
- All critical defects have been fixed
- Aggregated results are published as `docs/release/user-testing-report.md` (template below)
- The report is signed off by Vottun's tech lead

---

## Report Template — `user-testing-report.md`

After running the sessions, populate:

```markdown
# Wirex Stellar SDK 1.0.0 — Professional User Testing Report

**Period**: YYYY-MM-DD to YYYY-MM-DD
**Testers**: 3 external developers (anonymised)
**Hours**: ~7 hours total

## Tester Profile Summary
- Tester 1: …
- Tester 2: …
- Tester 3: …

## Scenario Outcomes
| Scenario | T1 | T2 | T3 |
|---|---|---|---|
| A — Simple Payment | ✓ 8min | ✓ 11min | ✓ 6min |
| B — Trustline + USDC | … | … | … |
| C — Wirex BaaS | … | … | … |
| D — Async deep dive | … | … | … |

## Defects Found and Resolved
| # | Severity | Description | Fixed in | Notes |
|---|---|---|---|---|
| 1 | Critical | … | 1.0.0 | … |
| 2 | Major | … | 1.0.1 | … |

## Documentation Gaps Closed
- …

## Verbatim Quotes
- …

## Sign-off
Vottun tech lead: ______________ Date: __________
```

