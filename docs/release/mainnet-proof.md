# Mainnet Transaction Proof (Tranche 3.4.8)

SCF #41 grant acceptance criterion: *"Successful mainnet transactions executed using the SDK."*

This guide walks through executing the proof transaction with [`scripts/mainnet-proof.ts`](../../scripts/mainnet-proof.ts) — a self-contained script that:

- Loads a wallet from either a **BIP39 mnemonic** *or* a **Stellar secret key**
- Connects to live mainnet Horizon
- Verifies sufficient balance before doing anything
- Prints a full plan and waits for explicit `"yes"` confirmation
- Submits a single small payment (default 0.0001 XLM)
- Auto-writes the proof artifacts to `docs/release/mainnet-proof-record.md`
- Supports self-payment if you don't have a separate destination handy
- Supports `--dry-run` mode for rehearsing the flow before spending real XLM

---

## What You Need

| Item | How to provide |
|---|---|
| **Source wallet** | Either a 12/24-word BIP39 mnemonic (`MAINNET_MNEMONIC`) or a Stellar secret key (`MAINNET_SECRET`). If both are set, mnemonic wins. |
| **Source funded** | The source account must hold **≥ 1.5 XLM** on mainnet (1 XLM reserve + amount + ~0.5 XLM fee headroom) |
| **Destination** | Any mainnet `G…` address (`MAINNET_DEST="G…"`) — or `MAINNET_DEST="self"` to send to source |
| **Amount** | Optional `MAINNET_AMOUNT` (default `0.0001` XLM ≈ $0.000016) |

---

## Environment Variables

| Variable | Required? | Example | Notes |
|---|---|---|---|
| `MAINNET_MNEMONIC` | one of these two | `"word1 word2 … word24"` | BIP39 phrase (12 or 24 words) |
| `MAINNET_SECRET` | one of these two | `"S....."` | Stellar secret key |
| `MAINNET_DERIVE_INDEX` | no | `0` | HD wallet account index when using mnemonic (default `0`) |
| `MAINNET_DEST` | **yes** | `"G..."` or `"self"` | Destination — use `"self"` for self-payment proof |
| `MAINNET_AMOUNT` | no | `"0.0001"` | XLM amount (default `0.0001`) |
| `MAINNET_DRY_RUN` | no | `"1"` | Skip the actual submission — useful for rehearsal |

**Never paste your secret key or mnemonic into chat, tickets, or PRs.** Set them in your shell only, ideally for one-time use.

---

## Step-by-Step Procedure

### 1. Rehearse (recommended — no XLM spent)

```bash
export MAINNET_MNEMONIC="your 24 words here"
export MAINNET_DEST="self"
export MAINNET_DRY_RUN="1"

nvm use 22
npx tsx scripts/mainnet-proof.ts
```

This prints the full plan, hits live mainnet Horizon to check the balance, builds and signs the transaction locally, and **stops short of submitting**. Use this to verify:
- The mnemonic loads to the right pubkey
- The account is funded
- The destination resolves correctly
- The amount and memo are what you want

### 2. Execute the real proof

Drop the dry-run flag:

```bash
unset MAINNET_DRY_RUN
npx tsx scripts/mainnet-proof.ts
```

The script prints the plan, requires you to type **`yes`** (exact, lowercase) to proceed, then:
- Builds, signs, and submits the transaction
- Waits for ledger inclusion
- Prints `hash`, `ledger`, `successful`, and three explorer URLs
- **Auto-writes** the proof record to `docs/release/mainnet-proof-record.md`

### 3. Commit the record

```bash
git add docs/release/mainnet-proof-record.md
git commit -m "Add mainnet proof tx for v1.0.0"
git push origin tranche_3
```

### 4. Add to the GitHub release

When you cut the `v1.0.0` GitHub release (per [release.md](./release.md)), paste a link to `mainnet-proof-record.md` in the release notes, and include the explorer URLs in the announcement.

---

## Worked Example — Using a Mnemonic

```bash
nvm use 22

# Set the source wallet (mnemonic — never paste into chat)
export MAINNET_MNEMONIC="alpha bravo charlie ... [24 words total]"

# Set the destination (self-payment to keep things simple)
export MAINNET_DEST="self"

# Dry-run first
export MAINNET_DRY_RUN="1"
npx tsx scripts/mainnet-proof.ts
# → Verify the source pubkey and balance look right

# Execute for real
unset MAINNET_DRY_RUN
npx tsx scripts/mainnet-proof.ts
# → Type "yes" when prompted
```

Expected output on success:

```
════════════════════════════════════════════════════════════════════════
  ✓ MAINNET TRANSACTION CONFIRMED
════════════════════════════════════════════════════════════════════════
  hash         : 1c7d…[64 hex chars]
  ledger       : 53124567
  successful   : true
  elapsed      : 4842 ms (build+sign+submit)

  Explorer URLs:
    https://stellar.expert/explorer/public/tx/1c7d…
    https://horizon.stellar.org/transactions/1c7d…
    https://stellarchain.io/tx/1c7d…
════════════════════════════════════════════════════════════════════════

  Proof record written to:
    /Users/.../stellar-sdk/docs/release/mainnet-proof-record.md
```

---

## Worked Example — Using a Secret Key

```bash
export MAINNET_SECRET="S....."
export MAINNET_DEST="G....."

npx tsx scripts/mainnet-proof.ts
```

Same flow; the script will tell you the source was loaded `via secret key (S…)`.

---

## Worked Example — HD Wallet Non-Zero Index

If your funded mainnet account is at derivation path `m/44'/148'/3'`:

```bash
export MAINNET_MNEMONIC="..."
export MAINNET_DERIVE_INDEX="3"
export MAINNET_DEST="self"
npx tsx scripts/mainnet-proof.ts
```

---

## Sample Auto-Generated Proof Record

The script writes a file like this to `docs/release/mainnet-proof-record.md`:

```markdown
# Wirex Stellar SDK 1.0.0 — Mainnet Proof of Acceptance

Captured automatically by `scripts/mainnet-proof.ts` for SCF #41 acceptance criterion 3.4.8.

## Transaction

| Field | Value |
|---|---|
| **Network** | Stellar Mainnet (`Public Global Stellar Network ; September 2015`) |
| **Tx hash** | `1c7d…` |
| **Ledger** | 53124567 |
| **Timestamp (UTC)** | 2026-05-19T12:34:56.789Z |
| **Source account** | `G…` |
| **Source loaded via** | mnemonic (BIP39, m/44'/148'/0') |
| **Destination account** | `G…` |
| **Asset** | XLM (native) |
| **Amount** | 0.0001 XLM |
| **Memo (text)** | `wirex-sdk-1.0.0-proof` |
| **End-to-end elapsed** | 4842 ms (build + sign + submit) |

## Explorer Links

- [Stellar Expert](https://stellar.expert/explorer/public/tx/1c7d…)
- [Horizon JSON](https://horizon.stellar.org/transactions/1c7d…)
- [StellarChain](https://stellarchain.io/tx/1c7d…)

## SDK Version

`@wirex/stellar-sdk@1.0.0`

## Sign-off

Vottun: ______________ Date: __________
Wirex (witness): ______________ Date: __________
```

After the script auto-writes the file, manually add the **fee_charged** value from any of the explorer links, then have it signed off.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Could not load source account from mainnet Horizon` | Account isn't on-chain yet | Send ≥ 2 XLM to the source address from an exchange first |
| `Insufficient XLM. Need ≥ 1.5001 XLM, have X` | Source balance below the script's safety threshold | Top up the source account |
| `MAINNET_MNEMONIC` produces a pubkey you don't recognise | Wrong derivation index | Set `MAINNET_DERIVE_INDEX` to match the index your wallet uses |
| `op_no_destination` on submission | Destination address doesn't exist on-chain | Use a funded mainnet destination, or use `"self"` |
| `tx_insufficient_fee` | Network fees spiked between balance check and submit | Bump `MAINNET_AMOUNT` to a value that leaves more fee headroom, or retry |

---

## Security Reminders

- The script **never logs your mnemonic or secret** — only the derived public key
- `Logger.level` is `'info'`, which excludes debug-only key references
- Do NOT commit `MAINNET_MNEMONIC` or `MAINNET_SECRET` in any form
- Prefer one-off shell-local exports over `.env` files for mainnet credentials
- After the proof transaction, consider rotating the source account if its secret was exposed during the session
